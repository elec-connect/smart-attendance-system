import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { 
  FaInfoCircle, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaExclamationCircle,
  FaTimes,
  FaChevronRight,
  FaStar,
  FaChartLine,
  FaUsers,
  FaCalendarAlt,
  FaClock
} from 'react-icons/fa';

// ==================== CARD VARIANTS CONFIGURATION ====================
const CARD_VARIANTS = {
  default: {
    bg: 'bg-white',
    border: 'border-gray-200',
    text: 'text-gray-900',
    icon: null,
    accent: 'border-l-4 border-l-primary-500'
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    icon: FaInfoCircle,
    accent: 'border-l-4 border-l-blue-500'
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-900',
    icon: FaCheckCircle,
    accent: 'border-l-4 border-l-green-500'
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-900',
    icon: FaExclamationTriangle,
    accent: 'border-l-4 border-l-yellow-500'
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
    icon: FaExclamationCircle,
    accent: 'border-l-4 border-l-red-500'
  },
  primary: {
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    text: 'text-primary-900',
    icon: null,
    accent: 'border-l-4 border-l-primary-500'
  },
  dark: {
    bg: 'bg-gray-800',
    border: 'border-gray-700',
    text: 'text-white',
    icon: null,
    accent: 'border-l-4 border-l-primary-400'
  },
  premium: {
    bg: 'bg-gradient-to-br from-purple-50 to-pink-50',
    border: 'border-purple-200',
    text: 'text-purple-900',
    icon: FaStar,
    accent: 'border-l-4 border-l-purple-500'
  }
};

// ==================== MAIN CARD COMPONENT ====================
const Card = ({
  children,
  variant = 'default',
  size = 'md',
  padding = 'default',
  shadow = 'md',
  border = true,
  rounded = 'lg',
  hover = false,
  clickable = false,
  accent = false,
  className = '',
  onClick,
  onClose,
  showClose = false,
  fullWidth = false,
  loading = false,
  disabled = false,
  ...props
}) => {
  const variantConfig = CARD_VARIANTS[variant] || CARD_VARIANTS.default;
  const IconComponent = variantConfig.icon;

  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const paddings = {
    none: '',
    xs: 'p-2',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
    xl: 'p-10'
  };

  const shadows = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    inner: 'shadow-inner',
    'hover-only': 'hover:shadow-lg'
  };

  const roundedStyles = {
    none: 'rounded-none',
    sm: 'rounded',
    default: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    full: 'rounded-full'
  };

  const cardClasses = clsx(
    'relative transition-all duration-200',
    variantConfig.bg,
    border && variantConfig.border,
    border && 'border',
    sizes[size],
    paddings[padding],
    shadows[shadow],
    roundedStyles[rounded],
    hover && 'hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01]',
    clickable && !disabled && 'cursor-pointer active:scale-[0.99]',
    clickable && !disabled && 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
    accent && variantConfig.accent,
    fullWidth && 'w-full',
    disabled && 'opacity-50 cursor-not-allowed',
    className
  );

  const handleClick = (e) => {
    if (!disabled && onClick && clickable) {
      onClick(e);
    }
  };

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable && !disabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (!disabled && clickable && (e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick(e);
        }
      }}
      aria-disabled={disabled}
      {...props}
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}

      {/* Icône de variante */}
      {IconComponent && (
        <div className="absolute top-4 left-4">
          <IconComponent className={clsx('w-5 h-5', variantConfig.text)} />
        </div>
      )}

      {/* Badge Premium */}
      {variant === 'premium' && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
          PREMIUM
        </div>
      )}

      {/* Bouton de fermeture */}
      {showClose && onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Fermer"
          disabled={disabled}
        >
          <FaTimes className="w-4 h-4 text-gray-500" />
        </button>
      )}

      {/* Contenu avec padding ajusté pour icônes */}
      <div className={clsx(
        IconComponent && 'pl-9',
        showClose && onClose && 'pr-8',
        variant === 'premium' && 'pt-6'
      )}>
        {children}
      </div>
    </div>
  );
};

Card.propTypes = {
  variant: PropTypes.oneOf(Object.keys(CARD_VARIANTS)),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  padding: PropTypes.oneOf(['none', 'xs', 'sm', 'default', 'lg', 'xl']),
  shadow: PropTypes.oneOf(['none', 'sm', 'md', 'lg', 'xl', 'inner', 'hover-only']),
  border: PropTypes.bool,
  rounded: PropTypes.oneOf(['none', 'sm', 'default', 'lg', 'xl', 'full']),
  hover: PropTypes.bool,
  clickable: PropTypes.bool,
  accent: PropTypes.bool,
  showClose: PropTypes.bool,
  fullWidth: PropTypes.bool,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  onClose: PropTypes.func,
  onClick: PropTypes.func,
};

// ==================== CARD HEADER ====================
const CardHeader = ({
  children,
  className = '',
  align = 'left',
  withDivider = false,
  action = null,
  ...props
}) => {
  const alignStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };

  return (
    <div
      className={clsx(
        'mb-4',
        withDivider && 'pb-4 border-b border-gray-200',
        alignStyles[align],
        action && 'flex items-start justify-between',
        className
      )}
      {...props}
    >
      <div className={action ? 'flex-1' : ''}>{children}</div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  );
};

CardHeader.propTypes = {
  align: PropTypes.oneOf(['left', 'center', 'right']),
  withDivider: PropTypes.bool,
  action: PropTypes.node,
};

// ==================== CARD TITLE ====================
const CardTitle = ({
  children,
  className = '',
  as: Component = 'h3',
  size = 'lg',
  truncate = false,
  ...props
}) => {
  const sizes = {
    sm: 'text-lg font-semibold',
    md: 'text-xl font-semibold',
    lg: 'text-2xl font-bold',
    xl: 'text-3xl font-bold'
  };

  return (
    <Component 
      className={clsx(
        sizes[size], 
        'text-gray-900',
        truncate && 'truncate',
        className
      )} 
      {...props}
    >
      {children}
    </Component>
  );
};

CardTitle.propTypes = {
  as: PropTypes.oneOf(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div']),
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  truncate: PropTypes.bool,
};

// ==================== CARD SUBTITLE ====================
const CardSubtitle = ({
  children,
  className = '',
  muted = true,
  ...props
}) => {
  return (
    <p
      className={clsx(
        'text-sm font-medium',
        muted ? 'text-gray-600' : 'text-gray-900',
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
};

CardSubtitle.propTypes = {
  muted: PropTypes.bool,
};

// ==================== CARD DESCRIPTION ====================
const CardDescription = ({
  children,
  className = '',
  muted = true,
  ...props
}) => {
  return (
    <p
      className={clsx(
        'mt-1',
        muted ? 'text-gray-600' : 'text-gray-900',
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
};

CardDescription.propTypes = {
  muted: PropTypes.bool,
};

// ==================== CARD CONTENT ====================
const CardContent = ({
  children,
  className = '',
  scrollable = false,
  maxHeight,
  padded = false,
  ...props
}) => {
  const contentClasses = clsx(
    scrollable && 'overflow-y-auto',
    padded && 'p-4',
    className
  );

  const style = maxHeight ? { maxHeight: `${maxHeight}px` } : {};

  return (
    <div className={contentClasses} style={style} {...props}>
      {children}
    </div>
  );
};

CardContent.propTypes = {
  scrollable: PropTypes.bool,
  maxHeight: PropTypes.number,
  padded: PropTypes.bool,
};

// ==================== CARD FOOTER ====================
const CardFooter = ({
  children,
  className = '',
  align = 'right',
  withDivider = true,
  ...props
}) => {
  const alignStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
    around: 'justify-around'
  };

  return (
    <div
      className={clsx(
        'mt-6 pt-6 flex items-center gap-3 flex-wrap',
        withDivider && 'border-t border-gray-200',
        alignStyles[align],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

CardFooter.propTypes = {
  align: PropTypes.oneOf(['left', 'center', 'right', 'between', 'around']),
  withDivider: PropTypes.bool,
};

// ==================== CARD MEDIA ====================
const CardMedia = ({
  src,
  alt = '',
  className = '',
  overlay = false,
  height = 'auto',
  overlayContent = null,
  children,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'relative overflow-hidden',
        height !== 'auto' && `h-${height}`,
        className
      )}
      {...props}
    >
      {src ? (
        <>
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
          />
          {overlay && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          )}
        </>
      ) : (
        children
      )}
      
      {overlayContent && (
        <div className="absolute inset-0 flex items-end p-6">
          {overlayContent}
        </div>
      )}
    </div>
  );
};

CardMedia.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  overlay: PropTypes.bool,
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  overlayContent: PropTypes.node,
};

// ==================== CARD STATS ====================
const CardStats = ({
  items,
  className = '',
  columns = 3,
  icon = false,
  ...props
}) => {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4'
  };

  const iconMap = {
    users: FaUsers,
    calendar: FaCalendarAlt,
    clock: FaClock,
    chart: FaChartLine,
    default: null
  };

  return (
    <div className={clsx('grid gap-4', gridCols[columns], className)} {...props}>
      {items?.map((item, index) => {
        const Icon = iconMap[item.icon] || iconMap.default;
        return (
          <div key={index} className="text-center p-3 rounded-lg bg-gray-50">
            {Icon && (
              <div className="flex justify-center mb-2">
                <Icon className="w-5 h-5 text-gray-600" />
              </div>
            )}
            <div className="text-2xl font-bold text-gray-900">{item.value}</div>
            <div className="text-sm text-gray-600">{item.label}</div>
            {item.trend && (
              <div className={clsx(
                'text-xs mt-1',
                item.trend > 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {item.trend > 0 ? '↑' : '↓'} {Math.abs(item.trend)}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

CardStats.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    icon: PropTypes.oneOf(['users', 'calendar', 'clock', 'chart']),
    trend: PropTypes.number
  })),
  columns: PropTypes.oneOf([2, 3, 4]),
  icon: PropTypes.bool,
};

// ==================== CARD LIST ====================
const CardList = ({
  items,
  className = '',
  dividers = true,
  clickableItems = false,
  onItemClick,
  ...props
}) => {
  return (
    <div className={className} {...props}>
      {items?.map((item, index) => (
        <div
          key={index}
          onClick={() => clickableItems && onItemClick && onItemClick(item)}
          className={clsx(
            'py-3',
            dividers && index < items.length - 1 && 'border-b border-gray-200',
            clickableItems && 'cursor-pointer hover:bg-gray-50 px-3 -mx-3 rounded'
          )}
        >
          {item}
        </div>
      ))}
    </div>
  );
};

CardList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.node),
  dividers: PropTypes.bool,
  clickableItems: PropTypes.bool,
  onItemClick: PropTypes.func,
};

// ==================== CARD ACTION ====================
const CardAction = ({
  children,
  className = '',
  icon = FaChevronRight,
  onClick,
  ...props
}) => {
  const Icon = icon;
  
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center justify-between w-full p-4 text-left hover:bg-gray-50 rounded-lg transition-colors',
        className
      )}
      {...props}
    >
      <span className="flex-1">{children}</span>
      {Icon && <Icon className="w-4 h-4 text-gray-400 ml-2" />}
    </button>
  );
};

CardAction.propTypes = {
  icon: PropTypes.elementType,
  onClick: PropTypes.func,
};

// ==================== CARD BADGE ====================
const CardBadge = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-primary-100 text-primary-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800'
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

CardBadge.propTypes = {
  variant: PropTypes.oneOf(['default', 'primary', 'success', 'warning', 'error', 'info']),
};

// ==================== CARD GRID ====================
const CardGrid = ({
  children,
  className = '',
  columns = 3,
  gap = 6,
  ...props
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
  };

  const gaps = {
    2: 'gap-2',
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8'
  };

  return (
    <div
      className={clsx(
        'grid',
        gridCols[columns],
        gaps[gap],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

CardGrid.propTypes = {
  columns: PropTypes.oneOf([1, 2, 3, 4, 5, 6]),
  gap: PropTypes.oneOf([2, 4, 6, 8]),
};

// ==================== EXPORT ALL COMPONENTS ====================
// Attachez tous les composants
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Subtitle = CardSubtitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;
Card.Media = CardMedia;
Card.Stats = CardStats;
Card.List = CardList;
Card.Action = CardAction;
Card.Badge = CardBadge;
Card.Grid = CardGrid;

export default Card;
export {
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardMedia,
  CardStats,
  CardList,
  CardAction,
  CardBadge,
  CardGrid
};