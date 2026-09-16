import './styling/Auth.css';

function Auth() {
  return (
    <>
      <div className="parent">
        <div className="auth-box">
          <label className="welcome-label">Welcome Back!</label>
          <button className="auth-button-login">Login</button>
          <button className="auth-button-signup">Sign Up</button>
        </div>
      </div>
    </>
  );
}

export default Auth;
