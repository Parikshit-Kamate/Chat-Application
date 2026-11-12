import React from 'react';
import { getChatName, getDisplayUsername } from '../messageUtils';

export default function SearchSettings({
  activeChat, currentUser, globalSearch, setGlobalSearch, messageSearch, setMessageSearch,
  globalResults, handleOpenSearchResult,
}) {

  return (
    <div className="sidebar-section">
      <div className="section-heading">
        <h3>Search</h3>
      </div>
    
      <div className="settings-search-grid">
        <div className="input-with-icon">
          <i className="bi bi-binoculars" />
          <input
            type="text"
            placeholder="Search all messages"
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
          />
        </div>
    
        {activeChat && (
          <div className="input-with-icon">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder={`Search ${getChatName(activeChat, currentUser.id)}`}
              value={messageSearch}
              onChange={(event) => setMessageSearch(event.target.value)}
            />
          </div>
        )}
      </div>
    
      {globalSearch.trim().length >= 2 && globalResults.length === 0 && <div className="section-helper">No results found.</div>}
    
      {globalResults.length > 0 && (
        <div className="global-search-results">
          {globalResults.slice(0, 8).map((result) => (
            <button key={result.id} type="button" onClick={() => handleOpenSearchResult(result)} className="global-result-item">
              <strong>{getDisplayUsername(result.sender)}</strong>
              <span>{result.text || 'Attachment'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
