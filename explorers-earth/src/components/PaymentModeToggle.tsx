import { AlertTriangle, TestTube2, Zap } from 'lucide-react';

interface PaymentModeToggleProps {
    mode: 'DEV' | 'PROD';
    onChange: (mode: 'DEV' | 'PROD') => void;
    disabled?: boolean;
}

/**
 * A toggle component for switching between DEV (test) and PROD (live) Razorpay modes.
 * Shows clear visual indicators and warnings for production mode.
 */
const PaymentModeToggle = ({ mode, onChange, disabled = false }: PaymentModeToggleProps) => {
    const isProduction = mode === 'PROD';

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isProduction ? (
                        <Zap className="w-4 h-4 text-amber-400" />
                    ) : (
                        <TestTube2 className="w-4 h-4 text-dashboard-accent" />
                    )}
                    <span className="text-sm font-medium text-white">
                        Payment Mode
                    </span>
                </div>

                {/* Toggle Switch */}
                <button
                    type="button"
                    onClick={() => !disabled && onChange(isProduction ? 'DEV' : 'PROD')}
                    disabled={disabled}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dashboard-bg ${disabled
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer'
                        } ${isProduction
                            ? 'bg-amber-500 focus:ring-amber-500'
                            : 'bg-dashboard-accent focus:ring-dashboard-accent'
                        }`}
                    aria-label={`Switch to ${isProduction ? 'DEV' : 'PROD'} mode`}
                >
                    <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${isProduction ? 'translate-x-8' : 'translate-x-1'
                            }`}
                    />
                    <span
                        className={`absolute left-1.5 text-[10px] font-bold transition-opacity duration-300 ${isProduction ? 'opacity-100 text-amber-900' : 'opacity-0'
                            }`}
                    >

                    </span>
                    <span
                        className={`absolute right-1.5 text-[10px] font-bold transition-opacity duration-300 ${isProduction ? 'opacity-0' : 'opacity-100 text-white'
                            }`}
                    >

                    </span>
                </button>
            </div>

            {/* Mode Badge */}
            <div className="flex items-center gap-2">
                <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isProduction
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-dashboard-accent/20 text-dashboard-accent border border-dashboard-accent/30'
                        }`}
                >
                    {isProduction ? (
                        <>
                            <Zap className="w-3 h-3" />
                            PRODUCTION - Real Payments
                        </>
                    ) : (
                        <>
                            <TestTube2 className="w-3 h-3" />
                            TEST MODE - No Real Charges
                        </>
                    )}
                </span>
            </div>

            {/* Production Warning */}
            {isProduction && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200">
                        <strong>Warning:</strong> You are in production mode. Real payments will be processed and your card will be charged.
                    </p>
                </div>
            )}
        </div>
    );
};

export default PaymentModeToggle;
