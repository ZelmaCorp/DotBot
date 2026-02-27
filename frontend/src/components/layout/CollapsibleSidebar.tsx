import React from 'react';
import dotbotLogo from '../../assets/dotbot-logo.svg';
import iconWrite from '../../assets/icon-write.svg';
import iconSearch from '../../assets/icon-search.svg';
import fetchAiLogo from '../../assets/fetch_ai.svg';

interface SidebarProps {
  onNewChat: () => void;
  onSearchChat: () => void;
  isExpanded: boolean;
  onToggle: (expanded: boolean) => void;
}

const CollapsibleSidebar: React.FC<SidebarProps> = ({
  onNewChat,
  onSearchChat,
  isExpanded,
  onToggle
}) => {
  const toggleSidebar = () => {
    onToggle(!isExpanded);
  };

  const menuItems = [
    {
      icon: iconWrite,
      label: 'New Chat',
      onClick: onNewChat
    },
    {
      icon: iconSearch,
      label: 'Search Chat',
      onClick: onSearchChat
    }
  ];

  return (
    <div className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Logo Toggle Button */}
      <div className="sidebar-header">
        <button
          onClick={toggleSidebar}
          className="sidebar-logo-button"
        >
          <img 
            src={dotbotLogo} 
            alt="DotBot" 
            style={{ height: '32px', width: '32px', flexShrink: 0 }}
          />
          {isExpanded && <span className="sidebar-logo-text">DotBot</span>}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item, index) => (
            <li key={index}>
              <button
                onClick={item.onClick}
                className="sidebar-nav-item"
                title={!isExpanded ? item.label : undefined}
              >
                <img 
                  src={item.icon} 
                  alt={item.label}
                  className="sidebar-nav-icon"
                  style={{ flexShrink: 0 }}
                />
                {isExpanded && (
                  <span>{item.label}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {isExpanded ? (
          <div className="sidebar-footer-expanded">
            <div className="sidebar-footer-powered">
              <img 
                src={fetchAiLogo} 
                alt="Fetch.ai" 
                className="sidebar-footer-logo"
              />
              <div className="sidebar-footer-text">
                Powered by ASI.One
              </div>
            </div>
            <div className="sidebar-footer-powered">
              <div className="sidebar-footer-logo-wrap">
                <img 
                  src="https://wiki.polkadot.network/img/logo-polkadot.svg"
                  alt="Polkadot"
                  className="sidebar-footer-logo sidebar-footer-polkadot-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.querySelector('.sidebar-footer-polkadot-placeholder')?.classList.add('visible');
                  }}
                />
                <span className="sidebar-footer-polkadot-placeholder" aria-hidden>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="#E6007A"/>
                  </svg>
                </span>
              </div>
              <div className="sidebar-footer-text">
                Powered by Polkadot
              </div>
            </div>
          </div>
        ) : (
          <div className="sidebar-footer-collapsed">
            <img 
              src={fetchAiLogo} 
              alt="Fetch.ai" 
              className="sidebar-footer-logo-collapsed"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CollapsibleSidebar;
