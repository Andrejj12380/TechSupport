import React from 'react';

interface UserAvatarProps {
    username: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ username, size = 'md', className = '' }) => {
    // Generate a deterministic color based on username
    const colors = [
        'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
        'bg-rose-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-teal-500',
        'bg-fuchsia-500', 'bg-orange-500'
    ];

    const textColors = [
        'text-blue-50', 'text-emerald-50', 'text-violet-50', 'text-amber-50',
        'text-rose-50', 'text-indigo-50', 'text-cyan-50', 'text-teal-50',
        'text-fuchsia-50', 'text-orange-50'
    ];

    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    const bgColor = colors[index];
    const textColor = textColors[index];

    const initials = username.substring(0, 2).toUpperCase();

    const sizeClasses = {
        sm: 'w-6 h-6 text-[10px]',
        md: 'w-8 h-8 text-xs',
        lg: 'w-10 h-10 text-sm',
        xl: 'w-12 h-12 text-base'
    };

    return (
        <div
            className={`rounded-full flex items-center justify-center font-bold font-sans shadow-inner ${sizeClasses[size]} ${bgColor} ${textColor} ${className}`}
            title={username}
        >
            {initials}
        </div>
    );
};

export default UserAvatar;
