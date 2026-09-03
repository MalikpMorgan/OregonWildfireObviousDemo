/** Compile-time feature flags. The GIBS satellite layer ships dark until enabled. */
export const GIBS_FEATURE_FLAG: boolean = import.meta.env.VITE_ENABLE_GIBS === 'true'
