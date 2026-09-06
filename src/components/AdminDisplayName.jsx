import React from 'react';

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

/**
 * Standalone rotating rainbow circle icon
 */
export const AdminRainbowCircle = ({ size = 'md', style = {}, title = 'Quản trị viên (Admin)' }) => {
    const sizeClass = size === 'sm' ? 'admin-rainbow-circle-sm' : size === 'lg' ? 'admin-rainbow-circle-lg' : '';

    return (
        <span
            className={`admin-rainbow-circle ${sizeClass}`}
            style={style}
            title={title}
            aria-label="Admin Rainbow Circle"
        >
            <span className="admin-rainbow-circle-inner" />
        </span>
    );
};

/**
 * Displays user name with Rainbow Circle for administrators everywhere
 */
export default function AdminDisplayName({
    name,
    username,
    role,
    isAdmin: explicitIsAdmin,
    size = 'md',
    showBadge = false,
    showRainbowCircle = true,
    className = '',
    style = {},
    nameStyle = {}
}) {
    const displayName = name || username || 'Người chơi';
    const isAdmin = explicitIsAdmin !== undefined 
        ? explicitIsAdmin 
        : checkIsAdmin(role || displayName, displayName);

    if (!isAdmin) {
        return (
            <span className={className} style={{ display: 'inline-flex', alignItems: 'center', ...style }}>
                <span style={nameStyle}>{displayName}</span>
            </span>
        );
    }

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
            {showRainbowCircle && <AdminRainbowCircle size={size} />}
            <span className="admin-rainbow-text" style={nameStyle}>
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
