import React from 'react';

export default function NoServicesMessage() {
  return (
    <div
      css={{
        textAlign: 'center',
        display: 'flex',
        flexGrow: '1',
        flexDirection: 'column',
        gap: 'var(--gap)',
      }}
    >
      <div css={{ height: 'var(--row-height)' }} />
      <div css={{ justifyContent: 'center', height: 'var(--row-height)' }}>CUSTOMER INFORMATION SYSTEM</div>
      <div css={{ height: 'var(--row-height)' }} />
    </div>
  );
}
