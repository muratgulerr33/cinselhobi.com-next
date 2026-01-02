"use client";

import { useEffect } from "react";
import { useHeaderContext } from "./header-context";

interface HeaderTitleProps {
  title: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  const { setTitle, clearTitle } = useHeaderContext();

  useEffect(() => {
    setTitle(title);
    return () => {
      clearTitle();
    };
  }, [title, setTitle, clearTitle]);

  return null;
}

