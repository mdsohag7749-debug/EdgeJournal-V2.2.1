// Reusable labeled input for auth forms. Wraps the existing `.field`
// styling (see src/index.css) already used across the app's other forms,
// with an optional leading icon and inline error message.

export default function FormField({ id, label, icon: Icon, error, ...inputProps }) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className={Icon ? 'auth-input-wrap' : undefined}>
        {Icon && (
          <span className="auth-input-icon">
            <Icon size={16} />
          </span>
        )}
        <input id={id} {...inputProps} />
      </div>
      {error && <span className="auth-error-text">{error}</span>}
    </div>
  );
}
