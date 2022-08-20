import React from 'react';
import PropTypes from 'prop-types';

import '../css/layout.less';
import '../css/fonts.css';

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/700.css';

const Layout = ({ children }) => {
  return <>{children}</>;
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
