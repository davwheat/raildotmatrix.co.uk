import React from 'react'

import TextBox from './Textbox'
import AutocompleteSelect from './AutocompleteSelect'
import Select from './Select'

export default function Form(props) {
  return <form {...props}></form>
}

export { TextBox, AutocompleteSelect, Select }
