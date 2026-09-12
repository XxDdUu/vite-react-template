import api, { getApiBaseUrl } from './api';

/**
 * Utility to check if an avatar string is an image URL vs an emoji icon.
 */
export const isImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const cleanUrl = url.trim().toLowerCase();
    return cleanUrl.startsWith('http://') || 
           cleanUrl.startsWith('https://') || 
           cleanUrl.startsWith('data:image/') || 
           cleanUrl.startsWith('blob:') ||
           cleanUrl.startsWith('/') ||
           cleanUrl.includes('/api/minio/files/') ||
           /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(cleanUrl);
};

/**
 * Formats relative avatar URLs (e.g. /api/minio/files/...) with backend base URL if needed.
 */
export const formatAvatarUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    let trimmed = url.trim();

    // Map old direct MinIO port 9000 S3 URLs to Spring Boot file proxy endpoint
    if (trimmed.includes(':9000/chess-avatars/') || trimmed.includes('/chess-avatars/avatars/')) {
        const idx = trimmed.indexOf('/avatars/');
        if (idx !== -1) {
            trimmed = `/api/minio/files${trimmed.substring(idx)}`;
        }
    }

    if (trimmed.startsWith('/api/minio/files/') || trimmed.startsWith('/api/upload/')) {
        const baseUrl = getApiBaseUrl();
        return baseUrl ? `${baseUrl}${trimmed}` : trimmed;
    }
    return trimmed;
};

export const MinioService = {
    /**
     * Upload an avatar image file to MinIO storage.
     * @param {File} file - Image file object selected by user
     * @returns {Promise<{ url: string }>} Upload result containing MinIO avatar URL
     */
    uploadAvatar: async (file) => {
        if (!file) {
            throw new Error('No file selected for upload');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'avatar');

        try {
            const response = await api.post('/api/minio/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            const url = response.data?.url || response.data?.fileUrl || response.data?.avatarUrl || response.data;
            if (typeof url === 'string' && url.length > 0) {
                return { url };
            }
            throw new Error('No valid URL returned from upload server');
        } catch (error) {
            console.warn('Backend MinIO endpoint upload unreached or returned error, applying preview fallback:', error?.message || error);
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ url: reader.result });
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
            });
        }
    },

    isImageUrl,
    formatAvatarUrl
};

export default MinioService;
