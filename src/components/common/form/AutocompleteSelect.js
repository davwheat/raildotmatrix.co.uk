import React from 'react';

import Select, { createFilter } from 'react-select';

export default function AutocompleteSelect({ label, helpText, placeholder, autocompleteOptions, onChange, ...props }) {
  return (
    <label className="form-textbox">
      {label}
      <Select
        onChange={onChange}
        className="form-textbox--input form-textbox--input__autocomplete"
        label={placeholder}
        options={autocompleteOptions}
        filterOption={createFilter({ ignoreAccents: false })}
        components={{
          MenuList,
        }}
        menuPortalTarget={typeof window !== 'undefined' && document.querySelector('body')}
        theme={(theme) => ({
          ...theme,
          colors: {
            ...theme.colors,
            neutral0: '#212121',
            neutral50: '#999',
            neutral80: '#bbb',
            text: 'black',
            primary25: '#FFA50099',
            primary50: '#FFA500bb',
            primary: 'orange',
          },
        })}
        {...props}
      />
      {helpText && <p className="form-textbox--help-text">{helpText}</p>}
    </label>
  );
}

const MenuList = function MenuList(props) {
  /** @type {any[]} */
  const children = props.children;

  if (!children.length) {
    return <div className="form-textbox--autocomplete-dropdown">{children}</div>;
  }

  return (
    <div className="form-textbox--autocomplete-dropdown">
      {children.length &&
        children.slice(0, 5).map((key, i) => {
          return (
            <div className="form-textbox--autocomplete-dropdown-item" key={i}>
              {key}
            </div>
          );
        })}
    </div>
  );
};
