import React from 'react';

export default function ErrorMessage() {
  return (
    <>
      <p className="display--no-services">
        <span>Live train information is currently unavailable</span>
      </p>
      <p className="display--no-services">
        <span>.&nbsp;&nbsp;.&nbsp;&nbsp;.</span>
      </p>
      <p className="display--no-services">
        <span>Please speak to staff for assistance</span>
      </p>
    </>
  );
}
