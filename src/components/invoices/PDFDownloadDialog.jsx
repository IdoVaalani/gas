import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";

export default function PDFDownloadDialog({ open, onOpenChange, invoice, onConfirm }) {
  const [num493, setNum493] = useState(invoice?.מספר_493 || "");
  const [invoiceDate, setInvoiceDate] = useState(invoice?.תאריך || new Date().toISOString().split('T')[0]);
  const [isCopy, setIsCopy] = useState(false);

  React.useEffect(() => {
    if (open && invoice) {
      setNum493(invoice.מספר_493 || "");
      setInvoiceDate(invoice.תאריך || new Date().toISOString().split('T')[0]);
      setIsCopy(false);
    }
  }, [open, invoice]);

  const handleConfirm = () => {
    if (!num493 || num493.trim() === "") {
      alert("יש להזין מספר 493");
      return;
    }
    onConfirm({ מספר_493: num493.trim(), תאריך: invoiceDate, isCopy });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            הורדת חשבונית PDF
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>מספר 493 *</Label>
            <Input
              type="text"
              value={num493}
              onChange={(e) => setNum493(e.target.value)}
              placeholder="נא להזין מספר 493"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">מספר 493 נדרש להדפסה</p>
          </div>
          <div>
            <Label>תאריך החשבון *</Label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">התאריך שיוצג בחשבונית המודפסת</p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isCopy"
              checked={isCopy}
              onCheckedChange={setIsCopy}
            />
            <Label htmlFor="isCopy" className="cursor-pointer">סמן כ"העתק"</Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 ml-2" />
              הורד PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}