import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext();

const Tabs = ({ defaultValue, children, className = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

const TabsList = ({ children, className = '' }) => {
  return (
    <div className={`flex space-x-2 border-b ${className}`}>
      {children}
    </div>
  );
};

const TabsTrigger = ({ value, children, className = '' }) => {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      className={`px-4 py-2 font-medium transition-colors ${
        isActive 
          ? 'border-b-2 border-blue-600 text-blue-600' 
          : 'text-gray-600 hover:text-gray-900'
      } ${className}`}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ value, children, className = '' }) => {
  const { activeTab } = useContext(TabsContext);

  if (activeTab !== value) return null;

  return (
    <div className={`mt-4 ${className}`}>
      {children}
    </div>
  );
};

// Export par défaut
export default Tabs;
// Exports nommés pour les sous-composants
export { TabsList, TabsTrigger, TabsContent };