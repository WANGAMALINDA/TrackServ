import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Logo from "./Logo";
import { supabase } from "./supabaseClient";
import "./styles.css";

const initialFormState = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const strictEmailPattern = /^[^\s@]+@([a-z0-9-]+\.)+[a-z]{2,63}$/i;

const passwordWrapStyle = { position: "relative", width: "100%" };
const passwordInputStyle = { paddingRight: 44, boxSizing: "border-box", width: "100%" };
const toggleButtonStyle = {
  position: "absolute",
  top: "50%",
  right: 12,
  transform: "translateY(-50%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#6b7280",
  cursor: "pointer",
};

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialFormState);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (event) => {
    const { id, value } = event.target;
    setForm((current) => ({ ...current, [id]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!strictEmailPattern.test(form.email.trim())) {
      setError("Enter a valid email address with a real domain, for example name@example.com.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match. Re-enter the same password in both fields.");
      return;
    }

    setSubmitting(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName },
      },
    });

    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const emailUsername = (form.email || "user").split("@")[0];

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            full_name: form.fullName,
            username: emailUsername,
            location: "Tshwane Municipality",
          },
          { onConflict: "id" }
        )
        .select("id, full_name, username, role, profile_picture")
        .single();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      navigate("/home", { replace: true, state: { profile } });
    } else {
      navigate("/login", {
        replace: true,
        state: { message: "Account created. Check your email to confirm it before logging in." },
      });
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo">
          <Logo />
          <p className="user-subtitle">Unified Citizen Hub</p>
        </div>

        <div className="header-block">
          <h2>Create an account</h2>
          <p className="subtitle">
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              value={form.fullName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div style={passwordWrapStyle}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete="new-password"
                style={passwordInputStyle}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                style={toggleButtonStyle}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <div style={passwordWrapStyle}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete="new-password"
                style={passwordInputStyle}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                aria-pressed={showConfirmPassword}
                style={toggleButtonStyle}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          <button className="login-btn" type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Register account"}
          </button>
        </form>

        <p className="register-text">
          Already have an account?
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;