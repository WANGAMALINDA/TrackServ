import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Logo from "./Logo";
import { supabase } from "./supabaseClient";
import "./UserLogin.css";

const initialFormState = {
  email: "",
  password: "",
  remember: false,
};

const initialErrors = {
  email: "",
  password: "",
};

function UserLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState(initialErrors);
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const nextErrors = {};

    if (!form.email.trim()) {
      nextErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!form.password.trim()) {
      nextErrors.password = "Password is required.";
    } else if (form.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setAuthError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");
    if (!validate()) return;

    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    setSubmitting(false);

    if (error) {
      setAuthError("Invalid email or password. Please try again.");
      return;
    }

    if (data.session) {
      navigate("/home");
    }
  };

  return (
    <div className="user-auth-page">
      <div className="user-auth-card" role="main" aria-labelledby="user-login-title">
        <div className="user-auth-header">

          <div className="logo">
            <Logo />
            <p className="user-subtitle">Unified Citizen Hub</p>
          </div>
          <div>
            <h1 id="user-login-title">User Login</h1>
          </div>
        </div>

        {location.state?.message && (
          <p className="field-error" style={{ color: "#227c59" }}>
            {location.state.message}
          </p>
        )}

        <form className="user-auth-form" onSubmit={handleSubmit} noValidate>
          <div className="user-field-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="name@company.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              autoComplete="email"
            />
            {errors.email && (
              <span className="field-error" id="email-error">
                {errors.email}
              </span>
            )}
          </div>

          <div className="user-field-group">
            <label htmlFor="password">Password</label>
            <div className="user-password-row">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <span className="field-error" id="password-error">
                {errors.password}
              </span>
            )}
          </div>

          <div className="user-options-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="remember"
                checked={form.remember}
                onChange={handleChange}
              />
              Remember me
            </label>
            <a className="forgot-link" href="#">
              Forgot password?
            </a>
          </div>

          {authError && <p className="field-error">{authError}</p>}

          <button className="user-auth-button" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="user-register-line">
          New to TrackServ? <Link to="/register">Create account</Link>
        </p>
      </div>
    </div>
  );
}

export default UserLogin;