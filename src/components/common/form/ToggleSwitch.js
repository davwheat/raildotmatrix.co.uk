import React from 'react';

import './css/ToggleSwitch.less';

const ToggleSwitch = React.forwardRef((props, ref) => {
  const { label, onChange, checked, defaultChecked } = props;
  return (
    <div className="toggle-switch">
      <label className="toggle-switch--label">
        <span>{label}</span>
        <div className="toggle-switch__container">
          <input ref={ref} type="checkbox" onChange={onChange} checked={checked} defaultChecked={typeof checked === 'undefined' && defaultChecked} />
          <div className="toggle-switch__slider"></div>
        </div>
      </label>
    </div>
  );
});

export default ToggleSwitch;
