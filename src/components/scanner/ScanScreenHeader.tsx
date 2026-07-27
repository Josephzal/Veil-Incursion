import React from 'react';
import RunFieldHeader from '../runField/RunFieldHeader';

interface ScanScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Retained for call-site compat — shared header no longer scales independently. */
  fontScale?: number;
}

/**
 * Field-scanner outer header — identical typography/utilities to RunFieldHeader.
 * Does not touch radar / VectorScanner presentation.
 */
export default function ScanScreenHeader({
  title,
  subtitle,
}: ScanScreenHeaderProps): React.JSX.Element {
  return (
    <RunFieldHeader
      eyebrow="FIELD INTERCEPT // FS-01"
      title={title}
      contextLine={subtitle ? `Live sweep · ${subtitle}` : undefined}
      showUtilities
    />
  );
}
