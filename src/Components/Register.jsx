import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { supabase } from "./supabaseClient";
import "./styles.css";

const initialFormState = {
  fullName: "",
  email: "",
  password: "",
};

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialFormState);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { id, value } = event.target;
    setForm((current) => ({ ...current, [id]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
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

      navigate("/home", { state: { profile } });
    } else {
      navigate("/login", {
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
            <input
              id="password"
              type="password"
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
            />
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