import React, { useState, useEffect } from 'react';

/**
 * Utility function to verify if a user object, role string, or username represents an administrator.
 */
export const checkIsAdmin = (userOrRole, username = '') => {
    if (!userOrRole && !username) return false;
    
    // Check if directly passed boolean
    if (typeof userOrRole === 'boolean') return userOrRole;

    // Check if role string
    if (typeof userOrRole === 'string') {
        const lower = userOrRole.toLowerCase();
        if (lower === 'role_admin' || lower === 'admin') return true;
    }

    // Check if user object
    if (typeof userOrRole === 'object' && userOrRole !== null) {
        if (userOrRole.role === 'ROLE_ADMIN' || userOrRole.role === 'admin') return true;
        if (userOrRole.isAdmin === true) return true;
        if (userOrRole.username && userOrRole.username.toLowerCase() === 'admin') return true;
    }

    if (username && typeof username === 'string' && username.toLowerCase() === 'admin') {
        return true;
    }

    return false;
};

// Global in-memory registry storing rainbow status for admin IDs and usernames
const adminRainbowRegistry = new Map();

/**
 * Update the rainbow status for an admin and notify all listening components
 */
export const setAdminRainbowStatus = (adminIdOrUsername, enabled) => {
    if (adminIdOrUsername === undefined || adminIdOrUsername === null) return;
    const key = String(adminIdOrUsername).trim().toLowerCase();
    const boolVal = Boolean(enabled);
    adminRainbowRegistry.set(key, boolVal);
    
    // Dispatch custom event for instant cross-component reactivity
    window.dispatchEvent(new CustomEvent('admin-rainbow-updated', {
        detail: { target: key, enabled: boolVal }
    }));
};

/**
 * Bulk set admin rainbow statuses (e.g. on application initialization)
 */
export const setAllAdminRainbowStatuses = (statusList) => {
    if (!Array.isArray(statusList)) return;
    statusList.forEach(item => {
        if (!item) return;
        const enabled = Boolean(item.rainbowNameEnabled);
        if (item.adminId != null) {
            adminRainbowRegistry.set(String(item.adminId).trim().toLowerCase(), enabled);
        }
        if (item.userId != null) {
            adminRainbowRegistry.set(String(item.userId).trim().toLowerCase(), enabled);
        }
        if (item.adminUsername) {
            adminRainbowRegistry.set(String(item.adminUsername).trim().toLowerCase(), enabled);
        }
        if (item.username) {
            adminRainbowRegistry.set(String(item.username).trim().toLowerCase(), enabled);
        }
    });
    window.dispatchEvent(new CustomEvent('admin-rainbow-updated', {
        detail: { bulk: true }
    }));
};

/**
 * Retrieve status from registry
 */
export const getAdminRainbowStatus = (adminId, username) => {
    if (adminId != null) {
        const keyId = String(adminId).trim().toLowerCase();
        if (adminRainbowRegistry.has(keyId)) {
            return adminRainbowRegistry.get(keyId);
        }
    }
    if (username) {
        const keyName = String(username).trim().toLowerCase();
        if (adminRainbowRegistry.has(keyName)) {
            return adminRainbowRegistry.get(keyName);
        }
    }
    return false;
};

/**
 * Standalone normal admin icon (shield)
 */
export const AdminIcon = ({ size = 'md', style = {}, title = 'Quản trị viên (Admin)' }) => {
    const sizeClass = size === 'sm' ? 'admin-icon-sm' : size === 'lg' ? 'admin-icon-lg' : '';
    const fontSize = size === 'sm' ? '0.85rem' : size === 'lg' ? '1.35rem' : '1rem';

    return (
        <span
            className={`admin-icon ${sizeClass}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                verticalAlign: 'middle',
                lineHeight: 1,
                fontSize,
                flexShrink: 0,
                ...style
            }}
            title={title}
            aria-label="Admin"
        >
            🛡️
        </span>
    );
};

// Keep backwards-compatible alias
export const AdminRainbowCircle = AdminIcon;

/**
 * Displays user name globally:
 * - Admin with rainbow enabled: <Name> with animated CSS rainbow gradient
 * - Admin with rainbow disabled: 🛡️ <Name> normal admin styling
 * - Normal player: normal styling
 */
export default function AdminDisplayName({
    user,
    name,
    username,
    userId,
    role,
    rainbowNameEnabled: propRainbowEnabled,
    isAdmin: explicitIsAdmin,
    size = 'md',
    showBadge = false,
    showIcon = true,
    showRainbowCircle, // backwards compat
    className = '',
    style = {},
    nameStyle = {}
}) {
    const displayName = username || name || user?.username || user?.name || 'Người chơi';
    const resolvedUserId = userId || user?.userId || user?.id;
    const resolvedRole = role || user?.role;
    const resolvedRainbowProp = propRainbowEnabled !== undefined 
        ? propRainbowEnabled 
        : user?.rainbowNameEnabled;

    const isAdmin = explicitIsAdmin !== undefined 
        ? explicitIsAdmin 
        : checkIsAdmin(user || resolvedRole || displayName, displayName);

    const [isRainbowActive, setIsRainbowActive] = useState(() => {
        if (!isAdmin) return false;
        if (resolvedRainbowProp !== undefined && resolvedRainbowProp !== null) {
            return Boolean(resolvedRainbowProp);
        }
        return getAdminRainbowStatus(resolvedUserId, displayName);
    });

    useEffect(() => {
        if (!isAdmin) {
            setIsRainbowActive(false);
            return;
        }

        if (resolvedRainbowProp !== undefined && resolvedRainbowProp !== null) {
            setIsRainbowActive(Boolean(resolvedRainbowProp));
        } else {
            setIsRainbowActive(getAdminRainbowStatus(resolvedUserId, displayName));
        }

        const handleUpdate = (e) => {
            const detail = e.detail;
            if (!detail) return;
            if (detail.bulk) {
                setIsRainbowActive(getAdminRainbowStatus(resolvedUserId, displayName));
                return;
            }
            const keyId = resolvedUserId != null ? String(resolvedUserId).trim().toLowerCase() : null;
            const keyName = displayName ? String(displayName).trim().toLowerCase() : null;
            if ((keyId && detail.target === keyId) || (keyName && detail.target === keyName)) {
                setIsRainbowActive(detail.enabled);
            }
        };

        window.addEventListener('admin-rainbow-updated', handleUpdate);
        return () => {
            window.removeEventListener('admin-rainbow-updated', handleUpdate);
        };
    }, [isAdmin, resolvedRainbowProp, resolvedUserId, displayName]);

    if (!isAdmin) {
        return (
            <span className={className} style={{ display: 'inline-flex', alignItems: 'center', ...style }}>
                <span style={nameStyle}>{displayName}</span>
            </span>
        );
    }

    const shouldShowIcon = showIcon && (showRainbowCircle !== false);

    // Global Rainbow Admin Name effect
    if (isRainbowActive) {
        const cleanName = displayName.replace(/^🌈\s*/, '');
        return (
            <span
                className={`admin-display-name-wrapper admin-rainbow-wrapper ${className}`}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    verticalAlign: 'middle',
                    ...style
                }}
            >
                {shouldShowIcon && <AdminIcon size={size} />}
                <span
                    className="admin-rainbow-name"
                    style={{
                        ...nameStyle
                    }}
                >
                    {cleanName}
                </span>
                {showBadge && (
                    <span className="admin-badge-pill" title="Tài khoản Quản trị viên" style={{ marginLeft: '4px' }}>
                        🛡️ Admin
                    </span>
                )}
            </span>
        );
    }

    // Normal Admin styling
    return (
        <span
            className={`admin-display-name-wrapper ${className}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                verticalAlign: 'middle',
                ...style
            }}
        >
            {shouldShowIcon && <AdminIcon size={size} />}
            <span
                className="admin-name"
                style={{
                    color: 'var(--accent-blue-hover, #60a5fa)',
                    fontWeight: '700',
                    ...nameStyle
                }}
            >
                {displayName}
            </span>
            {showBadge && (
                <span className="admin-badge-pill" title="Tài khoản Quản trị viên">
                    🛡️ Admin
                </span>
            )}
        </span>
    );
}
