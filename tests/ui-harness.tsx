import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Modal } from '../components/ui/modal';
import { NumberInput } from '../components/ui/number-input';

function Harness() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState(2);
  const [amount, setAmount] = useState(100);
  return <main><h1>POS component regression harness</h1>
    <button onClick={() => setOpen(true)}>Open payment</button>
    <label>Background field<input /></label>
    <Modal open={open} onClose={() => setOpen(false)} title="Payment" closeDisabled={busy}>
      <NumberInput aria-label="Quantity" value={qty} onValueChange={setQty} integer min={1} />
      <output aria-label="Committed quantity">{qty}</output>
      <NumberInput aria-label="Amount" value={amount} onValueChange={setAmount} emptyValue={0} />
      <output aria-label="Committed amount">{amount}</output>
      <button onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 800); }}>Save</button>
      <button onClick={() => setOpen(false)}>Cancel</button>
    </Modal>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
