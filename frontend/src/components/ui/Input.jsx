// src/components/ui/Input.jsx - VERSION CORRECTE
const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
    {...props}
  />
);

export default Input;