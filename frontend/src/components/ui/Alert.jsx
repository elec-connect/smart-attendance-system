import React from 'react';

const Alert = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-blue-50 text-blue-800',
    destructive: 'bg-red-50 text-red-800'
  };

  return (
    <div className={`p-4 rounded-md ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

const AlertDescription = ({ children, className = '' }) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

// Export par défaut
export default Alert;
// Export nommé pour le sous-composant
export { AlertDescription };