import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { supabase } from "./supabaseClient";
import "./UserLogin.css";

function ResetPassword() {
  const navigate = useNavigate();
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const recoveryType = new URLSearchParams(window.location.hash.slice(1)).get("type")
      || new URLSearchParams(window.location.search).get("type");
    if (recoveryType === "recovery") setRecoveryReady(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password.length < 6) {
      setErrorMessage("Your new password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The passwords don't match. Please enter them again.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage("We couldn't update your password. The reset link may have expired; request a new one and try again.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccessMessage("Your password has been updated. You can now sign in with your new password.");
    } catch {
      setErrorMessage("We couldn't update your password. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="user-auth-page">
      <section className="user-auth-card" role="main" aria-labelledby="reset-password-title">
        <div className="user-auth-header">
          <div className="logo">
            <Logo />
            <p className="user-subtitle">Unified Citizen Hub</p>
          </div>
          <div>
            <h1 id="reset-password-title">Reset your password</h1>
          </div>
        </div>

        {!recoveryReady ? (
          <>
            <p className="field-error" role="alert">
              This password reset link is invalid or has expired. Request a new reset email to continue.
            </p>
            <p className="user-register-line">
              <Link to="/login">Return to login</Link>
            </p>
          </>
        ) : successMessage ? (
          <>
            <p className="field-error" role="status" style={{ color: "#227c59" }}>{successMessage}</p>
            <button
              className="user-auth-button"
              type="button"
              onClick={() => navigate("/login", { replace: true, state: { message: successMessage } })}
            >
              Return to login
            </button>
          </>
        ) : (
          <>
            <p className="user-subtitle" style={{ marginBottom: 24 }}>
              Choose a new password for your TrackServ account.
            </p>
            <form className="user-auth-form" onSubmit={handleSubmit}>
              <div className="user-field-group">
                <label htmlFor="new-password">New password</label>
                <div className="user-password-row">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide new password" : "Show new password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div className="user-field-group">
                <label htmlFor="confirm-password">Confirm new password</label>
                <div className="user-password-row">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {errorMessage ? <p className="field-error" role="alert">{errorMessage}</p> : null}
              <button className="user-auth-button" type="submit" disabled={submitting}>
                {submitting ? "Updating password..." : "Update password"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export default ResetPassword;
