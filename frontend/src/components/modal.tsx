import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Native modal dialogs keep focus inside and make the underlying page inert. */
export function Modal({
    open,
    title,
    onClose,
    children,
    dismissible = true,
}: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    dismissible?: boolean;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        if (!open) return;
        const dialog = dialogRef.current!;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            dialog.close();
            document.body.style.overflow = previousOverflow;
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
                previousFocus.focus();
        };
    }, [open]);

    return createPortal(
        <dialog
            ref={dialogRef}
            className="modal"
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                if (dismissible) onClose();
            }}
        >
            <header className="modal-heading">
                <h2 id={titleId} tabIndex={-1} autoFocus>
                    {title}
                </h2>
                {dismissible ? (
                    <button type="button" className="secondary" onClick={onClose}>
                        Close
                    </button>
                ) : null}
            </header>
            {open ? children : null}
        </dialog>,
        document.body,
    );
}
