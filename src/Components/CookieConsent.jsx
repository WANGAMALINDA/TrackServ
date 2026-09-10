import { useEffect, useState } from 'react';

const CONSENT_COOKIE = 'trackserv_cookie_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

function readConsent() {
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`))
    ?.split('=')[1] || null;
}

function writeConsent(value) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${COOKIE_MAX_AGE}; Path=/TrackServ; SameSite=Lax${secure}`;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!readConsent());
  }, []);

  if (!visible) return null;

  const choose = (value) => {
    writeConsent(value);
    setVisible(false);
  };

  return (
    <aside
      aria-label="Cookie preferences"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 2000,
        width: 'min(420px, calc(100vw - 40px))',
        padding: 18,
        border: '1px solid #cfe5dc',
        borderRadius: 14,
        background: '#ffffff',
        boxShadow: '0 12px 32px rgba(15, 61, 48, 0.18)',
        color: '#16352d',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 8 }}>Privacy choices</strong>
      <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.5 }}>
        TrackServ uses one necessary cookie to remember this choice. No advertising or analytics cookies are enabled.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => choose('necessary')}
          style={{ border: '1px solid #16866d', borderRadius: 8, padding: '9px 12px', background: '#ffffff', color: '#16866d', cursor: 'pointer' }}
        >
          Necessary only
        </button>
        <button
          type="button"
          onClick={() => choose('accepted')}
          style={{ border: 0, borderRadius: 8, padding: '9px 12px', background: '#16866d', color: '#ffffff', cursor: 'pointer' }}
        >
          Accept
        </button>
      </div>
    </aside>
  );
}
