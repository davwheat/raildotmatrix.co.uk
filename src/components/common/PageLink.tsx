import React, { useState } from 'react';
import { navigate } from 'gatsby';

interface IProps {
  onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => boolean;
  className?: string;
  children: React.ReactNode;
  to?: string;
  afterExit?: () => void;
  [x: string]: unknown;
}

export default function PageLink({ onClick, className, children, to, afterExit, ...props }: IProps) {
  const [isExiting, setIsExiting] = useState(false);

  let classes = '';

  if (className) {
    classes = 'train-link ' + className;
  } else {
    classes = 'train-link';
  }

  if (isExiting) {
    classes += ' train-link__exiting';
  }

  return (
    <a
      tabIndex={to ? undefined : 0}
      href={to}
      className={classes}
      {...props}
      onClick={(e) => {
        e.preventDefault();

        if (typeof onClick === 'function') {
          const h = onClick(e);

          if (h === false) {
            return;
          }
        }

        setIsExiting(true);

        setTimeout(() => {
          typeof to !== 'undefined' && navigate(to);
          typeof afterExit === 'function' && afterExit();
        }, 1100);
      }}
    >
      <span>{children}</span>
    </a>
  );
}
