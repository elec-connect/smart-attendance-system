import React, { useState } from 'react';

const Select = ({ value, onValueChange, children, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (newValue) => {
    onValueChange(newValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        className="w-full px-3 py-2 text-left border rounded-md bg-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value || 'Select...'}
      </button>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
};

const SelectTrigger = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};

const SelectContent = ({ children, className = '' }) => {
  return <div className={`py-1 ${className}`}>{children}</div>;
};

const SelectItem = ({ value, children, className = '' }) => {
  return (
    <div
      className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${className}`}
      onClick={() => value}
    >
      {children}
    </div>
  );
};

const SelectValue = ({ placeholder = '' }) => {
  return <span>{placeholder}</span>;
};

// Export par défaut
export default Select;
// Exports nommés pour les sous-composants
export { SelectTrigger, SelectContent, SelectItem, SelectValue };