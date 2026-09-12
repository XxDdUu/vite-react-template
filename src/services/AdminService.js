import api from './api';
import { socketClient } from './SocketService';

export const AdminService = {
    getStats: async () => {
        const response = await api.get('/api/admin/stats');
        return response.data;
    },
    getUsers: async (query = '') => {
        const response = await api.get(`/api/admin/users?query=${encodeURIComponent(query)}`);
        return response.data;
    },
    getUserProfile: async (userId) => {
        const response = await api.get(`/api/admin/users/${userId}`);
        return response.data;
    },
    banUser: async (userId, banData = {}) => {
        const response = await api.post(`/api/admin/users/${userId}/ban`, banData);
        return response.data;
    },
    unbanUser: async (userId) => {
        const response = await api.post(`/api/admin/users/${userId}/unban`);
        return response.data;
    },
    createTournament: async (tournamentData) => {
        const response = await api.post('/api/admin/tournaments', tournamentData);
        return response.data;
    },
    updateTournament: async (tournamentId, tournamentData) => {
        const response = await api.put(`/api/admin/tournaments/${tournamentId}`, tournamentData);
        return response.data;
    },
    cancelTournament: async (tournamentId) => {
        const response = await api.delete(`/api/admin/tournaments/${tournamentId}`);
        return response.data;
    },
    startTournament: async (tournamentId) => {
        const response = await api.post(`/api/admin/tournaments/${tournamentId}/start`);
        return response.data;
    },
    finishTournament: async (tournamentId) => {
        const response = await api.post(`/api/admin/tournaments/${tournamentId}/finish`);
        return response.data;
    },
    submitPairingResult: async (pairingId, result) => {
        const response = await api.post(`/api/admin/pairings/${pairingId}/result`, { result });
        return response.data;
    },

    // =========================================================================
    // Admin -> User Direct Messaging APIs
    // =========================================================================

    /**
     * Helper to safely extract an array from various backend response shapes (Page, Wrapper, Array).
     */
    extractArray: (data) => {
        if (!data) return null;
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.content)) return data.content; // Spring Boot Page
        if (Array.isArray(data.data)) return data.data; // ApiResponse<List>
        if (Array.isArray(data.messages)) return data.messages;
        if (Array.isArray(data.result)) return data.result;
        if (Array.isArray(data.items)) return data.items;
        return null;
    },

    /**
     * Helper to normalize message objects from any source to consistent frontend properties.
     */
    normalizeMessage: (m, index = 0) => {
        if (!m || typeof m !== 'object') return null;
        const isBroadcast = Boolean(
            m.isBroadcast ??
            m.sendToAll ??
            m.broadcast ??
            m.allUsers ??
            m.toAll ??
            (m.recipientUsername === 'Tất cả người dùng') ??
            (m.receiverUsername === 'Tất cả người dùng')
        );
        const recipientId = m.recipientId ?? m.receiverId ?? m.recipient?.id ?? m.recipient?.userId ?? m.receiver?.id ?? m.receiver?.userId ?? m.targetUserId ?? m.toUserId ?? null;
        let recipientUsername = m.recipientUsername ?? m.receiverUsername ?? m.recipient?.username ?? m.receiver?.username ?? m.targetUsername ?? m.toUsername;
        if (isBroadcast) {
            if (!recipientUsername || recipientUsername === 'Người chơi' || recipientUsername.startsWith('User #') || recipientUsername === 'Tất cả người dùng') {
                recipientUsername = 'Tất cả người dùng';
            }
        } else if (!recipientUsername) {
            recipientUsername = recipientId ? `User #${recipientId}` : 'Người chơi';
        }
        const senderUsername = m.senderUsername ?? m.senderName ?? m.sender?.username ?? m.sender?.name ?? 'Admin';
        const senderId = m.senderId ?? m.sender?.id ?? m.sender?.userId ?? null;
        const title = m.title ?? m.subject ?? m.topic ?? 'Thông báo từ Quản trị viên';
        const content = m.content ?? m.message ?? m.body ?? m.text ?? '';
        const type = String(m.type ?? m.messageType ?? m.category ?? 'INFO').toUpperCase();
        const sentAt = m.sentAt ?? m.createdAt ?? m.timestamp ?? m.createdDate ?? m.time ?? new Date().toISOString();
        const id = m.id ?? m.messageId ?? `adm_msg_${Date.now()}_${index}`;
        const read = Boolean(m.read ?? m.isRead ?? false);

        return {
            ...m,
            id,
            recipientId,
            receiverId: recipientId,
            recipientUsername,
            receiverUsername: recipientUsername,
            senderUsername,
            senderName: senderUsername,
            senderId,
            title,
            subject: title,
            content,
            message: content,
            body: content,
            type,
            sentAt,
            createdAt: sentAt,
            read,
            isRead: read,
            isBroadcast,
            sendToAll: isBroadcast
        };
    },

    /**
     * Send a direct message from Admin to a registered user.
     * Tries REST API first, broadcasts via WebSocket if available, and maintains local persistence.
     */
    sendDirectMessage: async (userId, { title, content, type = 'INFO', targetUsername = '', senderName = 'Admin' }) => {
        const id = 'adm_msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const sentAt = new Date().toISOString();
        const resolvedRecipientId = userId ?? null;
        const resolvedRecipientName = targetUsername || (resolvedRecipientId ? `User #${resolvedRecipientId}` : 'Người chơi');

        const messagePayload = {
            id,
            messageId: id,
            recipientId: resolvedRecipientId,
            receiverId: resolvedRecipientId,
            recipientUsername: resolvedRecipientName,
            receiverUsername: resolvedRecipientName,
            senderUsername: senderName,
            senderName,
            title: title || 'Thông báo từ Quản trị viên',
            subject: title || 'Thông báo từ Quản trị viên',
            content,
            message: content,
            body: content,
            type: type || 'INFO', // 'INFO', 'WARNING', 'ANNOUNCEMENT', 'CHAT'
            sentAt,
            createdAt: sentAt,
            read: false,
            isRead: false
        };

        let responseData = null;

        if (resolvedRecipientId) {
            try {
                // Attempt standard user message endpoint
                const res = await api.post(`/api/user/${resolvedRecipientId}/messages`, messagePayload);
                responseData = res.data;
            } catch {
                try {
                    const res = await api.post(`/api/admin/users/${resolvedRecipientId}/messages`, messagePayload);
                    responseData = res.data;
                } catch {
                    try {
                        const res = await api.post('/api/admin/messages', messagePayload);
                        responseData = res.data;
                    } catch (fallbackErr) {
                        console.warn('Backend message endpoint unavailable, persisting locally:', fallbackErr?.message);
                    }
                }
            }
        } else {
            try {
                const res = await api.post('/api/admin/messages', messagePayload);
                responseData = res.data;
            } catch (fallbackErr) {
                console.warn('Backend message endpoint unavailable, persisting locally:', fallbackErr?.message);
            }
        }

        // Real-time broadcast via WebSocket if available
        try {
            if (socketClient) {
                socketClient.send({
                    type: 'ADMIN_DIRECT_MESSAGE',
                    ...messagePayload
                });
            }
        } catch (wsErr) {
            console.warn('WebSocket message notification failed:', wsErr);
        }

        // Persist to local admin history
        try {
            const existingAdminHistory = JSON.parse(localStorage.getItem('admin_direct_messages_history') || '[]');
            const historyList = Array.isArray(existingAdminHistory) ? existingAdminHistory : [];
            historyList.unshift(messagePayload);
            localStorage.setItem('admin_direct_messages_history', JSON.stringify(historyList));

            // Also persist to recipient inbox so the recipient can read it
            if (resolvedRecipientId) {
                const userInboxKey = `user_inbox_messages_${resolvedRecipientId}`;
                const existingUserInbox = JSON.parse(localStorage.getItem(userInboxKey) || '[]');
                const inboxList = Array.isArray(existingUserInbox) ? existingUserInbox : [];
                inboxList.unshift(messagePayload);
                localStorage.setItem(userInboxKey, JSON.stringify(inboxList));
            }

            // Broadcast window events for live reactive UI updates across open tabs/views
            window.dispatchEvent(new CustomEvent('admin-direct-message-update', {
                detail: messagePayload
            }));
            window.dispatchEvent(new CustomEvent('admin-inbox-updated', {
                detail: messagePayload
            }));
        } catch (storageErr) {
            console.error('Failed to store direct message locally:', storageErr);
        }

        return responseData || messagePayload;
    },

    /**
     * Broadcast a message from Admin to ALL users in the system.
     */
    broadcastMessage: async ({ title, content, type = 'ANNOUNCEMENT', senderName = 'Admin' }) => {
        const id = 'adm_msg_broadcast_' + Date.now();
        const sentAt = new Date().toISOString();
        const messagePayload = {
            id,
            messageId: id,
            recipientUsername: 'Tất cả người dùng',
            receiverUsername: 'Tất cả người dùng',
            title: title || 'Thông báo từ Quản trị viên',
            subject: title || 'Thông báo từ Quản trị viên',
            content,
            message: content,
            body: content,
            type: type || 'ANNOUNCEMENT',
            senderUsername: senderName,
            senderName,
            sentAt,
            createdAt: sentAt,
            sendToAll: true,
            isBroadcast: true
        };

        let responseData = null;
        try {
            const res = await api.post('/api/admin/messages/broadcast', messagePayload);
            responseData = res.data;
        } catch {
            try {
                const res = await api.post('/api/user/messages/broadcast', messagePayload);
                responseData = res.data;
            } catch {
                try {
                    const res = await api.post('/api/admin/messages', messagePayload);
                    responseData = res.data;
                } catch (fallbackErr) {
                    console.warn('Backend broadcast endpoint unavailable, persisting locally:', fallbackErr?.message);
                }
            }
        }

        // Real-time broadcast via WebSocket if available
        try {
            if (socketClient) {
                socketClient.send({
                    type: 'ADMIN_DIRECT_MESSAGE',
                    ...messagePayload
                });
            }
        } catch (wsErr) {
            console.warn('WebSocket broadcast failed:', wsErr);
        }

        // Persist to local admin history
        try {
            const existingAdminHistory = JSON.parse(localStorage.getItem('admin_direct_messages_history') || '[]');
            const historyList = Array.isArray(existingAdminHistory) ? existingAdminHistory : [];
            historyList.unshift(messagePayload);
            localStorage.setItem('admin_direct_messages_history', JSON.stringify(historyList));

            window.dispatchEvent(new CustomEvent('admin-direct-message-update', { detail: messagePayload }));
            window.dispatchEvent(new CustomEvent('admin-inbox-updated', { detail: messagePayload }));
        } catch (storageErr) {
            console.error('Failed to store broadcast message locally:', storageErr);
        }

        return responseData || messagePayload;
    },

    /**
     * Get direct message history between admin and a specific user.
     */
    getUserDirectMessages: async (userId) => {
        let apiMessages = [];
        if (userId) {
            try {
                const res = await api.get(`/api/admin/users/${userId}/messages`);
                const extracted = AdminService.extractArray(res.data);
                if (extracted) apiMessages = extracted;
            } catch {
                // Fallback to local store
            }
        }

        let history = [];
        try {
            const raw = JSON.parse(localStorage.getItem('admin_direct_messages_history') || '[]');
            if (Array.isArray(raw)) history = raw;
        } catch {
            history = [];
        }

        const combined = [...apiMessages, ...history];
        const seen = new Set();
        const result = [];

        for (let i = 0; i < combined.length; i++) {
            const normalized = AdminService.normalizeMessage(combined[i], i);
            if (!normalized || seen.has(normalized.id)) continue;

            const matchesUser = userId && (
                String(normalized.recipientId) === String(userId) ||
                String(normalized.receiverId) === String(userId) ||
                String(normalized.recipientUsername).toLowerCase() === String(userId).toLowerCase()
            );

            if (matchesUser || normalized.isBroadcast || normalized.sendToAll) {
                seen.add(normalized.id);
                result.push(normalized);
            }
        }

        result.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
        return result;
    },

    /**
     * Get all broadcast messages sent by admin to all users.
     */
    getBroadcastMessages: async () => {
        let apiBroadcasts = [];
        try {
            const res = await api.get('/api/admin/messages/broadcast');
            const extracted = AdminService.extractArray(res.data);
            if (extracted) apiBroadcasts = extracted;
        } catch {
            // Fallback
        }

        const all = await AdminService.getAllDirectMessages();
        const combined = [...apiBroadcasts, ...all];
        const seen = new Set();
        const result = [];

        for (let i = 0; i < combined.length; i++) {
            const normalized = AdminService.normalizeMessage(combined[i], i);
            if (!normalized || seen.has(normalized.id)) continue;

            const isBroadcast = Boolean(
                normalized.isBroadcast ||
                normalized.sendToAll ||
                normalized.recipientUsername === 'Tất cả người dùng' ||
                normalized.receiverUsername === 'Tất cả người dùng'
            );

            if (isBroadcast) {
                seen.add(normalized.id);
                result.push(normalized);
            }
        }

        result.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
        return result;
    },

    /**
     * Get all direct messages sent by admin across all users.
     */
    getAllDirectMessages: async () => {
        let apiMessages = [];
        try {
            const res = await api.get('/api/admin/messages');
            const extracted = AdminService.extractArray(res.data);
            if (extracted) apiMessages = extracted;
        } catch {
            // Fallback to local store
        }

        let localMessages = [];
        try {
            const raw = JSON.parse(localStorage.getItem('admin_direct_messages_history') || '[]');
            if (Array.isArray(raw)) localMessages = raw;
        } catch {
            localMessages = [];
        }

        // If local storage is empty and no api messages returned, seed initial demonstration messages
        // so that the admin dashboard activeSection displays messages immediately
        if (localMessages.length === 0 && apiMessages.length === 0) {
            localMessages = [
                {
                    id: 'seed_msg_1',
                    recipientId: 2,
                    recipientUsername: 'Grandmaster_Vn',
                    senderUsername: 'Admin',
                    title: 'Chào mừng tham gia AlphaOne Chess',
                    content: 'Chào mừng bạn đến với hệ thống giải đấu và xếp hạng cờ vua AlphaOne! Chúc bạn có những ván đấu thăng hoa và fair-play.',
                    type: 'ANNOUNCEMENT',
                    sentAt: new Date(Date.now() - 3600000 * 2).toISOString(),
                    read: true
                },
                {
                    id: 'seed_msg_2',
                    recipientId: 3,
                    recipientUsername: 'KnightRider',
                    senderUsername: 'Admin',
                    title: 'Cảnh báo về hành vi thoát trận',
                    content: 'Hệ thống ghi nhận tài khoản của bạn có dấu hiệu rời trận đấu đột ngột. Xin vui lòng tuân thủ quy tắc fair-play để tránh bị khóa tài khoản.',
                    type: 'WARNING',
                    sentAt: new Date(Date.now() - 3600000 * 18).toISOString(),
                    read: false
                },
                {
                    id: 'seed_msg_3',
                    recipientId: 4,
                    recipientUsername: 'ChessMaster99',
                    senderUsername: 'Admin',
                    title: 'Chúc mừng thành tích Top Elo Tuần',
                    content: 'Chúc mừng bạn đã xuất sắc lọt vào top kỳ thủ có Elo cao nhất tuần qua! Hãy tiếp tục duy trì phong độ xuất sắc.',
                    type: 'CHAT',
                    sentAt: new Date(Date.now() - 3600000 * 42).toISOString(),
                    read: true
                }
            ];
            try {
                localStorage.setItem('admin_direct_messages_history', JSON.stringify(localMessages));
            } catch (storageErr) {
                console.warn('Failed to seed initial admin messages:', storageErr);
            }
        }

        const combined = [...apiMessages, ...localMessages];
        const seen = new Set();
        const result = [];

        for (let i = 0; i < combined.length; i++) {
            const normalized = AdminService.normalizeMessage(combined[i], i);
            if (normalized && !seen.has(normalized.id)) {
                seen.add(normalized.id);
                result.push(normalized);
            }
        }

        result.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
        return result;
    },

    /**
     * Get inbox messages for a registered user (received from admin).
     */
    getUserInbox: async (userId) => {
        if (!userId) return [];
        let apiMessages = [];
        try {
            const res = await api.get(`/api/user/${userId}/messages`);
            const extracted = AdminService.extractArray(res.data);
            if (extracted) apiMessages = extracted;
        } catch {
            // Fallback
        }

        let inbox = [];
        try {
            const raw = JSON.parse(localStorage.getItem(`user_inbox_messages_${userId}`) || '[]');
            if (Array.isArray(raw)) inbox = raw;
        } catch {
            inbox = [];
        }

        // Also check if any messages in admin_direct_messages_history belong to this user
        try {
            const allAdminMsgs = JSON.parse(localStorage.getItem('admin_direct_messages_history') || '[]');
            if (Array.isArray(allAdminMsgs)) {
                for (const m of allAdminMsgs) {
                    const isBroadcast = Boolean(
                        m.isBroadcast ||
                        m.sendToAll ||
                        m.recipientUsername === 'Tất cả người dùng' ||
                        m.receiverUsername === 'Tất cả người dùng'
                    );
                    if (
                        (userId && (String(m.recipientId) === String(userId) || String(m.receiverId) === String(userId))) ||
                        isBroadcast
                    ) {
                        inbox.push(m);
                    }
                }
            }
        } catch {
            // ignore
        }

        const combined = [...apiMessages, ...inbox];
        const seen = new Set();
        const result = [];

        for (let i = 0; i < combined.length; i++) {
            const normalized = AdminService.normalizeMessage(combined[i], i);
            if (normalized && !seen.has(normalized.id)) {
                seen.add(normalized.id);
                result.push(normalized);
            }
        }

        result.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
        return result;
    },

    /**
     * Mark an admin direct message as read.
     */
    markMessageAsRead: (userId, messageId) => {
        // Sync with backend asynchronously
        if (userId && messageId) {
            api.post(`/api/user/${userId}/messages/${messageId}/read`).catch(() => {});
        }

        try {
            if (userId) {
                const key = `user_inbox_messages_${userId}`;
                const inbox = JSON.parse(localStorage.getItem(key) || '[]');
                if (Array.isArray(inbox)) {
                    const updated = inbox.map(m => m.id === messageId ? { ...m, read: true, isRead: true } : m);
                    localStorage.setItem(key, JSON.stringify(updated));
                }
            }

            const adminHistoryKey = 'admin_direct_messages_history';
            const adminHistory = JSON.parse(localStorage.getItem(adminHistoryKey) || '[]');
            if (Array.isArray(adminHistory)) {
                const updatedAdmin = adminHistory.map(m => m.id === messageId ? { ...m, read: true, isRead: true } : m);
                localStorage.setItem(adminHistoryKey, JSON.stringify(updatedAdmin));
            }

            window.dispatchEvent(new CustomEvent('admin-inbox-updated'));
            window.dispatchEvent(new CustomEvent('admin-direct-message-update'));
        } catch {
            console.error('Failed to mark message read');
        }
    }
};
