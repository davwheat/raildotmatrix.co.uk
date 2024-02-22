import React from 'react';

import Select, { SingleValue, createFilter } from 'react-select';

interface Option {
  label: string;
  value: string;
}

interface IProps {
  label: React.ReactNode;
  helpText?: React.ReactNode;
  placeholder?: string;
  autocompleteOptions: Option[];
  onChange?: (value: SingleValue<string>) => void;
  value?: string;
}

export default function AutocompleteSelect({ label, helpText, placeholder, autocompleteOptions, onChange, ...props }: IProps) {
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
        menuPortalTarget={typeof window !== 'undefined' ? document.querySelector('body') : undefined}
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

interface IMenuListProps {
  children: React.ReactNode;
}

function MenuList(props: IMenuListProps) {
  const children = props.children;

  if (!Array.isArray(children) || children.length === 0) {
    return <div className="form-textbox--autocomplete-dropdown">{children}</div>;
  }

  return (
    <div className="form-textbox--autocomplete-dropdown">
      {(children.slice(0, 5) as any[]).map((key, i) => {
        return (
          <div className="form-textbox--autocomplete-dropdown-item" key={i}>
            {key}
          </div>
        );
      })}
    </div>
  );
}
