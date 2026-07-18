import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import "./styles.css";

const initialFormState = {
  fullName: "",
  email: "",
  password: "",
};

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialFormState);

  const handleChange = (event) => {
    const { id, value } = event.target;
    setForm((current) => ({ ...current, [id]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    navigate("/home");
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
            />
          </div>

          <button className="login-btn" type="submit">
            Register account
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