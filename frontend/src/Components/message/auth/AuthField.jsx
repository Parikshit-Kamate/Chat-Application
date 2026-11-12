import React from 'react';

export default function AuthField({ name, label, authForm, setAuthForm, ...inputProps }) {
  return (
    <>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        value={authForm[name] || ''}
        onChange={(event) => setAuthForm((form) => ({ ...form, [name]: event.target.value }))}
        {...inputProps}
      />
    </>
  );
}
