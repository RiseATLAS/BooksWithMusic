// Terms of Service Module
// Handles ToS acceptance for first-time users

import { db } from '../config/firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const TERMS_VERSION = '1.0';

const TERMS_TEXT = `
<h2>Terms of Use</h2>

<h3>1. User-Provided Content</h3>
<p>You may upload ebook files (including EPUB) that you own or are otherwise legally entitled to use.</p>

<h3>2. License to the Service</h3>
<p>By uploading content, you grant the Service a limited, non-exclusive license to store, process, analyze, and transform the content solely for the purpose of providing the Service to you.</p>
<p>The Service processes content automatically and does not review uploaded books unless required to address legal or technical issues.</p>
<p>This license lasts only while you use the Service or until the content is deleted.</p>

<h3>3. No Redistribution</h3>
<p>Your content is not shared with other users, sold, or used for any purpose other than delivering the Service to you.</p>

<h3>4. Responsibility and Rights</h3>
<p>You confirm that you have the legal right to upload and use the content in this way.</p>
<p>You remain the rights holder. The Service does not claim ownership.</p>

<h3>5. Content Removal</h3>
<p>The Service may remove content or suspend access if there are credible rights concerns or misuse.</p>
<p>Content can be deleted at your request.</p>

<h3>6. Limited Availability</h3>
<p>The Service is experimental and provided "as is." Availability and continuity are not guaranteed.</p>

<h3>7. Contact</h3>
<p>Users or rights holders may contact the Service regarding content concerns.</p>
`;

/**
 * Check if user has accepted current terms
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if terms accepted
 */
export async function hasAcceptedTerms(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    return userData.termsAccepted === true && userData.termsVersion === TERMS_VERSION;
  } catch (error) {
    console.error('Error checking terms acceptance:', error);
    return false;
  }
}

/**
 * Record user's acceptance of terms
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function acceptTerms(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Terms accepted by user:', userId);
  } catch (error) {
    console.error('Error recording terms acceptance:', error);
    throw error;
  }
}

/**
 * Show terms of service modal
 * @returns {Promise<boolean>} Resolves to true if accepted, false if rejected
 */
export function showTermsModal() {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'terms-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'terms-modal';
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      max-width: 600px;
      max-height: 80vh;
      width: 90%;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
    // Modal content
    modal.innerHTML = `
      <div style="padding: 24px; border-bottom: 1px solid #e0e0e0;">
        <h2 style="margin: 0; color: #333; font-size: 24px;">Welcome to BooksWithMusic</h2>
        <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">Please review and accept our Terms of Use to continue</p>
      </div>
      <div style="padding: 24px; overflow-y: auto; flex: 1;">
        <div class="terms-content" style="color: #333; line-height: 1.6;">
          ${TERMS_TEXT}
        </div>
      </div>
      <div style="padding: 24px; border-top: 1px solid #e0e0e0; display: flex; gap: 12px; justify-content: flex-end;">
        <button class="terms-decline" style="
          padding: 12px 24px;
          border: 1px solid #ccc;
          background: white;
          color: #333;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        ">Decline</button>
        <button class="terms-accept" style="
          padding: 12px 24px;
          border: none;
          background: #2196F3;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        ">Accept & Continue</button>
      </div>
    `;
    
    // Add hover effects
    const style = document.createElement('style');
    style.textContent = `
      .terms-modal h3 {
        color: #2196F3;
        margin-top: 20px;
        margin-bottom: 8px;
        font-size: 16px;
      }
      .terms-modal p {
        margin: 8px 0;
        font-size: 14px;
      }
      .terms-decline:hover {
        background: #f5f5f5;
        border-color: #999;
      }
      .terms-accept:hover {
        background: #1976D2;
      }
      .terms-accept:active {
        transform: scale(0.98);
      }
      .terms-decline:active {
        transform: scale(0.98);
      }
    `;
    document.head.appendChild(style);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Handle buttons
    const acceptBtn = modal.querySelector('.terms-accept');
    const declineBtn = modal.querySelector('.terms-decline');
    
    const cleanup = () => {
      document.body.removeChild(overlay);
      document.head.removeChild(style);
      document.body.style.overflow = '';
    };
    
    acceptBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });
    
    declineBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
    
    // Prevent closing by clicking overlay
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        // Don't close - user must explicitly accept or decline
      }
    });
  });
}

/**
 * Check and prompt for terms acceptance if needed
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if terms accepted (or already accepted), false if declined
 */
export async function checkAndPromptTerms(userId) {
  try {
    // FOR TESTING: Always show the modal to all users
    // To revert to normal behavior, uncomment the code below and remove the forced prompt
    
    /*
    const accepted = await hasAcceptedTerms(userId);
    
    if (accepted) {
      return true;
    }
    */
    
    console.log('🔍 [TEST MODE] Showing Terms of Service to all users for testing');
    
    // Show modal and wait for user decision
    const userAccepted = await showTermsModal();
    
    if (userAccepted) {
      await acceptTerms(userId);
      return true;
    } else {
      console.log('❌ User declined terms');
      return false;
    }
  } catch (error) {
    console.error('Error in terms check:', error);
    return false;
  }
}
