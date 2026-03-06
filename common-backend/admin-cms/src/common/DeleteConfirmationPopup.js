import React from 'react';
import '../css/styles.css';

const DeleteConfirmationPopup = ({ 
  isVisible, 
  message, 
  onConfirm, 
  onCancel, 
  confirmButtonText = "Confirm", 
  cancelButtonText = "Cancel",
  isPermanentDelete = false,
  action = 'delete' // 'delete' or 'revert'
}) => {
  if (!isVisible) return null;

  // Determine title and button styling based on action
  const getTitle = () => {
    if (action === 'revert') return 'Confirm Restore';
    if (isPermanentDelete) return 'Confirm Permanent Deletion';
    return 'Confirm Deletion';
  };

  const getConfirmButtonClass = () => {
    if (action === 'revert') return 'btnSuccess'; // Green button for restore
    if (isPermanentDelete) return 'btnDanger'; // Red button for permanent delete
    return 'btnWarning'; // Orange button for soft delete
  };

  const getConfirmButtonText = () => {
    if (action === 'revert') return 'RESTORE';
    if (isPermanentDelete) return 'DELETE PERMANENTLY';
    return confirmButtonText;
  };

  return (
    <div className="deleteConfirmationOverlay">
      <div className="deleteConfirmationPopup">
        <div className="deleteConfirmationHeader">
          <h3 className="deleteConfirmationTitle">{getTitle()}</h3>
        </div>
        
        <div className="deleteConfirmationBody">
          <p className="deleteConfirmationMessage">{message}</p>
        </div>
        
        <div className="deleteConfirmationActions">
          <button
            type="button"
            className="btnSecondary deleteConfirmationCancelBtn"
            onClick={onCancel}
          >
            {cancelButtonText}
          </button>
          <button
            type="button"
            className={`${getConfirmButtonClass()} deleteConfirmationDeleteBtn`}
            onClick={onConfirm}
          >
            {getConfirmButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationPopup; 