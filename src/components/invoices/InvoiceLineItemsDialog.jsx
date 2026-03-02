import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function InvoiceLineItemsDialog({
  open, onOpenChange,
  currentInvoiceLines, currentTotals,
  lineItemForm, setLineItemForm,
  workSearch, setWorkSearch,
  itemSearchText, setItemSearchText,
  creditSearch, setCreditSearch,
  globalIncludeLinkedWorks, setGlobalIncludeLinkedWorks,
  items,
  handleAddLine,
  deleteLineMutation,
  localLineSorts, handleLocalSortChange,
  bulkUpdateLinesMutation, handleApplySorting,
  getLineSort,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ניהול שורות חשבון</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleAddLine} className="border-b pb-4 mb-4">
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3">
            <input
              type="checkbox"
              id="globalIncludeLinkedWorks"
              checked={globalIncludeLinkedWorks}
              onChange={(e) => setGlobalIncludeLinkedWorks(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="globalIncludeLinkedWorks" className="cursor-pointer font-medium">
              כלול עבודות מקושרות לפריטים
            </Label>
          </div>
          <Tabs defaultValue="work" className="w-full mb-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="work" onClick={() => { setLineItemForm({...lineItemForm, סוג_שורה: "עבודה", פריט_id: "", תיאור: "", מחיר_יחידה: 0, כמות: 1, הנחה_אחוז: 0, מיון_שורות: 1}); setWorkSearch(""); }}>עבודה</TabsTrigger>
              <TabsTrigger value="item" onClick={() => { setLineItemForm({...lineItemForm, סוג_שורה: "פריט", פריט_id: "", תיאור: "", מחיר_יחידה: 0, כמות: 1, הנחה_אחוז: 0, מיון_שורות: 1}); setItemSearchText(""); }}>פריט</TabsTrigger>
              <TabsTrigger value="credit" onClick={() => { setLineItemForm({...lineItemForm, סוג_שורה: "זיכוי_מלאי", פריט_id: "", תיאור: "", מחיר_יחידה: 0, כמות: 1, הנחה_אחוז: 0, מיון_שורות: 1}); setCreditSearch(""); }}>חומרים לזיכוי מלאי</TabsTrigger>
            </TabsList>

            {["work", "item", "credit"].map((tabVal) => {
              const isWork = tabVal === "work";
              const isCredit = tabVal === "credit";
              const סוג = isWork ? "עבודה" : isCredit ? "זיכוי_מלאי" : "פריט";
              const searchVal = isWork ? workSearch : isCredit ? creditSearch : itemSearchText;
              const setSearch = isWork ? setWorkSearch : isCredit ? setCreditSearch : setItemSearchText;
              const itemType = isWork ? "עבודה" : "פריט";
              const btnColor = isWork ? "bg-purple-600 hover:bg-purple-700" : isCredit ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700";
              const btnLabel = isWork ? "הוסף עבודה" : isCredit ? "הוסף לזיכוי מלאי" : "הוסף פריט";
              const placeholder = isWork ? "הזן תיאור העבודה" : isCredit ? "הזן תיאור הפריט לזיכוי מלאי" : "הזן תיאור הפריט";

              return (
                <TabsContent key={tabVal} value={tabVal} className="mt-3">
                  <div className="space-y-3">
                    <div>
                      <Label>בחר {isWork ? 'עבודה' : 'פריט'} (אופציונלי)</Label>
                      <Select
                        value={lineItemForm.פריט_id || ""}
                        onValueChange={(value) => {
                          if (value) {
                            const item = items.find(i => i.id === value);
                            if (item) {
                              setLineItemForm({ ...lineItemForm, פריט_id: value, תיאור: item.שם_פריט, מחיר_יחידה: item.מחיר_מכירה, סוג_שורה: סוג });
                              setSearch("");
                            }
                          } else {
                            setLineItemForm({ ...lineItemForm, פריט_id: "", תיאור: "", מחיר_יחידה: 0, סוג_שורה: סוג });
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder={`בחר ${isWork ? 'עבודה' : 'פריט'} או הזן ידנית`} /></SelectTrigger>
                        <SelectContent className="max-h-[400px]">
                          <div className="sticky top-0 bg-white p-2 border-b">
                            <Input value={searchVal} onChange={(e) => { e.stopPropagation(); setSearch(e.target.value); }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="h-8" />
                          </div>
                          <div className="p-1">
                            <SelectItem value={null}>ללא - הזנה ידנית</SelectItem>
                            {items.filter(i => i.פעיל && i.סוג_פריט === itemType).filter(i => {
                              if (!searchVal) return true;
                              const s = searchVal.toLowerCase().trim();
                              return (i.שם_פריט || '').toLowerCase().includes(s) || (i.מספר_קטלוג || '').toLowerCase().includes(s) || (i.תיאור || '').toLowerCase().includes(s);
                            }).map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                <div className="flex flex-col items-start">
                                  <div className="font-medium">{item.שם_פריט}</div>
                                  <div className="text-xs text-gray-500">{item.מספר_קטלוג && `קטלוג: ${item.מספר_קטלוג} | `}₪{item.מחיר_מכירה?.toFixed(2)}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>תיאור *</Label>
                      <Textarea value={lineItemForm.תיאור} onChange={(e) => setLineItemForm({...lineItemForm, תיאור: e.target.value})} placeholder={placeholder} required rows={2} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label>כמות *</Label><Input type="number" min="0.01" step="0.01" value={lineItemForm.כמות} onChange={(e) => setLineItemForm({...lineItemForm, כמות: e.target.value})} required /></div>
                      <div><Label>מחיר ליחידה *</Label><Input type="number" min="0" step="0.01" value={lineItemForm.מחיר_יחידה} onChange={(e) => setLineItemForm({...lineItemForm, מחיר_יחידה: e.target.value})} required /></div>
                      <div><Label>הנחה %</Label><Input type="number" min="0" max="100" step="0.1" value={lineItemForm.הנחה_אחוז} onChange={(e) => setLineItemForm({...lineItemForm, הנחה_אחוז: e.target.value})} /></div>
                    </div>
                    <Button type="submit" className={`w-full ${btnColor}`}><Plus className="w-4 h-4 ml-2" />{btnLabel}</Button>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </form>

        {currentInvoiceLines.length > 0 ? (
          <div className="space-y-6">
            {[{type: 'עבודה', badge: 'bg-purple-100 text-purple-800'}, {type: 'פריט', badge: 'bg-blue-100 text-blue-800'}, {type: 'זיכוי_מלאי', badge: 'bg-green-100 text-green-800', label: 'חומרים לזיכוי מלאי'}].map(({type, badge, label}) => {
              const lines = currentInvoiceLines.filter(l => l.סוג_שורה === type);
              if (lines.length === 0) return null;
              return (
                <div key={type}>
                  <h3 className="font-semibold mb-3 text-lg flex items-center gap-2"><Badge className={badge}>{label || type}</Badge></h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>מיון</TableHead><TableHead>תיאור</TableHead><TableHead>כמות</TableHead><TableHead>מחיר</TableHead><TableHead>הנחה</TableHead><TableHead>סה"כ</TableHead><TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-bold text-blue-600">
                            <Input type="number" min="1" max="100" value={getLineSort(line)} onChange={(e) => handleLocalSortChange(line.id, parseInt(e.target.value) || 1)} className="w-16 h-8 text-center" />
                          </TableCell>
                          <TableCell>{line.תיאור}</TableCell>
                          <TableCell>{line.כמות}</TableCell>
                          <TableCell>₪{line.מחיר_יחידה?.toFixed(2)}</TableCell>
                          <TableCell>{line.הנחה_אחוז}%</TableCell>
                          <TableCell className="font-bold">₪{line.סכום_שורה?.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => deleteLineMutation.mutate(line.id)} className="text-red-600" title="מחק שורה"><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50 mb-4">
            <p>אין שורות בחשבון זה</p>
            <p className="text-sm mt-1">הוסף שורות באמצעות הטופס למעלה</p>
          </div>
        )}

        <div className="border-t pt-4 mt-4">
          <div className="space-y-2 text-left">
            <div className="flex justify-between"><span>סכום לפני מע"מ:</span><span className="font-bold">₪{currentTotals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>מע"מ (18%):</span><span className="font-bold">₪{currentTotals.vat.toFixed(2)}</span></div>
            <div className="flex justify-between text-lg border-t pt-2"><span className="font-bold">סה"כ כולל מע"מ:</span><span className="font-bold text-green-600">₪{currentTotals.total.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          {Object.keys(localLineSorts).length > 0 && (
            <Button onClick={handleApplySorting} className="bg-blue-600 hover:bg-blue-700" disabled={bulkUpdateLinesMutation.isPending}>
              {bulkUpdateLinesMutation.isPending ? 'מעדכן...' : 'מיין עכשיו'}
            </Button>
          )}
          <Button type="button" onClick={() => onOpenChange(false)} variant="outline">סגור</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}