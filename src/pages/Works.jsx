import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Wrench, Search, Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Download } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function WorksPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState(null);

  const [formData, setFormData] = useState({
    מספר_קטלוג: "",
    שם_פריט: "",
    תיאור: "",
    סוג_פריט: "עבודה",
    מחיר_מכירה: "",
    עבודות_מקושרות: [],
    פעיל: true
  });

  const queryClient = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ['פריט'],
    queryFn: () => base44.entities.פריט.list('-updated_date'),
    initialData: [],
  });

  const works = items.filter(i => i.סוג_פריט === "עבודה");

  const generateUniqueCatalogNumber = () => {
    let catalogNumber;
    let isUnique = false;
    while (!isUnique) {
      catalogNumber = Math.floor(100000 + Math.random() * 900000).toString();
      isUnique = !items.some(item => item.מספר_קטלוג === catalogNumber);
    }
    return catalogNumber;
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.מספר_קטלוג || data.מספר_קטלוג.trim() === "") {
        data.מספר_קטלוג = generateUniqueCatalogNumber();
      }
      const existingItem = items.find(item => item.מספר_קטלוג === data.מספר_קטלוג);
      if (existingItem) throw new Error(`מספר קטלוג ${data.מספר_קטלוג} כבר קיים במערכת`);
      return await base44.entities.פריט.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['פריט'] }); setIsDialogOpen(false); resetForm(); },
    onError: (error) => alert(error.message || 'שגיאה ביצירת עבודה'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (data.מספר_קטלוג) {
        const existingItem = items.find(item => item.מספר_קטלוג === data.מספר_קטלוג && item.id !== id);
        if (existingItem) throw new Error(`מספר קטלוג ${data.מספר_קטלוג} כבר קיים במערכת`);
      }
      return await base44.entities.פריט.update(id, data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['פריט'] }); setIsDialogOpen(false); resetForm(); },
    onError: (error) => alert(error.message || 'שגיאה בעדכון עבודה'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.פריט.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['פריט'] }),
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.csv')) {
      alert("פורמטים נתמכים: .xlsx, .csv");
      e.target.value = null;
      return;
    }
    setImportFile(file);
    setIsProcessing(true);
    setImportPreview(null);
    setImportResults(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "מספר קטלוג": { type: "string" },
              "שם פריט": { type: "string" },
              "תיאור": { type: "string" },
              "מחיר מכירה": { type: "number" }
            },
            required: ["שם פריט", "מחיר מכירה"]
          }
        }
      });
      if (result.status === "success" && result.output) {
        const mappedRecords = result.output.map(record => ({
          מספר_קטלוג: record["מספר קטלוג"] ? String(record["מספר קטלוג"]) : "",
          שם_פריט: record["שם פריט"] ? String(record["שם פריט"]) : "",
          תיאור: record["תיאור"] ? String(record["תיאור"]) : "",
          סוג_פריט: "עבודה",
          מחיר_מכירה: parseFloat(record["מחיר מכירה"]) || 0,
          פעיל: true
        })).filter(r => r.שם_פריט && r.שם_פריט.trim() !== '' && r.מחיר_מכירה >= 0);
        if (mappedRecords.length > 0) setImportPreview(mappedRecords);
        else alert("לא נמצאו עבודות תקינות בקובץ.");
      } else {
        alert("שגיאה בעיבוד הקובץ: " + (result.details || "פורמט לא תקין."));
      }
    } catch (error) {
      alert("שגיאה בעיבוד הקובץ: " + error.message);
      if (e.target) e.target.value = null;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    setIsProcessing(true);
    try {
      const seenCatalogNumbers = new Set(items.map(item => item.מספר_קטלוג));
      const generatedCatalogNumbers = new Set();
      const finalRecords = [];
      const duplicates = [];

      for (const record of importPreview) {
        let catalogNum = record.מספר_קטלוג;
        if (!catalogNum || catalogNum.trim() === "") {
          let num;
          do { num = Math.floor(100000 + Math.random() * 900000).toString(); } while (seenCatalogNumbers.has(num) || generatedCatalogNumbers.has(num));
          generatedCatalogNumbers.add(num);
          catalogNum = num;
        }
        if (!seenCatalogNumbers.has(catalogNum)) {
          finalRecords.push({ ...record, מספר_קטלוג: catalogNum });
          seenCatalogNumbers.add(catalogNum);
        } else {
          duplicates.push(catalogNum);
        }
      }

      if (finalRecords.length > 0) await base44.entities.פריט.bulkCreate(finalRecords);
      setImportResults({ success: true, count: finalRecords.length, duplicates: duplicates.length });
      await queryClient.invalidateQueries({ queryKey: ['פריט'] });
      setTimeout(() => { setIsImportDialogOpen(false); setImportFile(null); setImportPreview(null); setImportResults(null); }, 3000);
    } catch (error) {
      setImportResults({ success: false, error: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    const headers = ['מספר קטלוג', 'שם פריט', 'תיאור', 'מחיר מכירה', 'סטטוס'];
    const rows = works.map(item => [
      item.מספר_קטלוג || '',
      item.שם_פריט || '',
      item.תיאור || '',
      item.מחיר_מכירה?.toFixed(2) || '0.00',
      item.פעיל ? 'פעיל' : 'לא פעיל'
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `עבודות_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({ מספר_קטלוג: "", שם_פריט: "", תיאור: "", סוג_פריט: "עבודה", מחיר_מכירה: "", עבודות_מקושרות: [], פעיל: true });
    setEditingItem(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = {
      מספר_קטלוג: formData.מספר_קטלוג || "",
      שם_פריט: formData.שם_פריט,
      תיאור: formData.תיאור || "",
      סוג_פריט: "עבודה",
      מחיר_מכירה: parseFloat(formData.מחיר_מכירה),
      עבודות_מקושרות: [],
      פעיל: formData.פעיל
    };
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data: dataToSubmit });
    else createMutation.mutate(dataToSubmit);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ מספר_קטלוג: item.מספר_קטלוג || "", שם_פריט: item.שם_פריט, תיאור: item.תיאור || "", סוג_פריט: "עבודה", מחיר_מכירה: item.מחיר_מכירה, עבודות_מקושרות: [], פעיל: item.פעיל });
    setIsDialogOpen(true);
  };

  const filteredWorks = works.filter(item =>
    item.שם_פריט?.includes(searchTerm) || item.מספר_קטלוג?.includes(searchTerm) || item.תיאור?.includes(searchTerm)
  );

  return (
    <div className="p-3 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Wrench className="w-6 h-6 md:w-8 md:h-8" />
              ניהול עבודות
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">רשימת כל העבודות והשירותים ({works.length})</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full md:w-auto">
            <Button variant="outline" onClick={handleExport} className="border-green-600 text-green-600 hover:bg-green-50">
              <Download className="w-4 h-4 ml-2" />
              ייצוא ל-Excel
            </Button>

            <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
              setIsImportDialogOpen(open);
              if (!open) { setImportFile(null); setImportPreview(null); setImportResults(null); setIsProcessing(false); }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                  <Upload className="w-4 h-4 ml-2" />
                  ייבוא מ-Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    ייבוא עבודות מקובץ Excel
                  </DialogTitle>
                </DialogHeader>
                {!importPreview && !importResults && (
                  <div className="space-y-4">
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertDescription>
                        <p className="font-semibold mb-2">📋 עמודות נדרשות:</p>
                        <div className="text-sm space-y-1">
                          <div><strong>שם פריט</strong> - שם העבודה (חובה)</div>
                          <div><strong>מחיר מכירה</strong> - מחיר (חובה)</div>
                          <div><strong>מספר קטלוג</strong> - אופציונלי</div>
                          <div><strong>תיאור</strong> - אופציונלי</div>
                        </div>
                      </AlertDescription>
                    </Alert>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors">
                      <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <div className="text-sm text-gray-600 mb-3">קבצים נתמכים: .xlsx, .csv</div>
                      <Input id="file-upload-works" type="file" accept=".xlsx,.csv" onChange={handleFileSelect} className="hidden" />
                      <Button type="button" variant="outline" onClick={() => { const i = document.getElementById('file-upload-works'); i.value = null; i.click(); }}>
                        בחר קובץ
                      </Button>
                    </div>
                    {isProcessing && (
                      <div className="flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>מעבד קובץ...</span>
                      </div>
                    )}
                  </div>
                )}
                {importPreview && !importResults && (
                  <div className="space-y-4">
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <AlertDescription>נמצאו {importPreview.length} עבודות בקובץ</AlertDescription>
                    </Alert>
                    <div className="max-h-80 overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>מספר קטלוג</TableHead>
                            <TableHead>שם עבודה</TableHead>
                            <TableHead>מחיר</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.slice(0, 10).map((record, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-sm">{record.מספר_קטלוג || 'אוטומטי'}</TableCell>
                              <TableCell className="text-sm font-medium">{record.שם_פריט}</TableCell>
                              <TableCell className="text-sm font-bold text-green-600">₪{record.מחיר_מכירה.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {importPreview.length > 10 && <div className="p-3 text-center text-sm text-gray-500">מוצגות 10 ראשונות מתוך {importPreview.length}</div>}
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => { setImportPreview(null); setImportFile(null); }}>ביטול</Button>
                      <Button onClick={handleImport} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">
                        {isProcessing ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מייבא...</> : <><CheckCircle className="w-4 h-4 ml-2" />אשר ייבוא</>}
                      </Button>
                    </div>
                  </div>
                )}
                {importResults && (
                  <Alert className={importResults.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                    {importResults.success ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                    <AlertDescription>
                      {importResults.success ? (
                        <div>
                          <div className="font-semibold text-green-900">הייבוא הושלם בהצלחה!</div>
                          <div className="text-sm text-green-700">{importResults.count} עבודות נוספו</div>
                          {importResults.duplicates > 0 && <div className="text-sm text-orange-700">⚠️ {importResults.duplicates} דולגו (כפולות)</div>}
                        </div>
                      ) : (
                        <div><div className="font-semibold text-red-900">שגיאה בייבוא</div><div className="text-sm text-red-700">{importResults.error}</div></div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700" onClick={resetForm}>
                  <Plus className="w-4 h-4 ml-2" />
                  עבודה חדשה
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'עריכת עבודה' : 'עבודה חדשה'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>מספר קטלוג (אופציונלי)</Label>
                    <Input value={formData.מספר_קטלוג} onChange={(e) => setFormData({...formData, מספר_קטלוג: e.target.value})} placeholder="יווצר אוטומטית אם ריק" />
                  </div>
                  <div>
                    <Label>שם עבודה *</Label>
                    <Input value={formData.שם_פריט} onChange={(e) => setFormData({...formData, שם_פריט: e.target.value})} placeholder="הזן שם עבודה" required />
                  </div>
                  <div>
                    <Label>תיאור</Label>
                    <Textarea value={formData.תיאור} onChange={(e) => setFormData({...formData, תיאור: e.target.value})} placeholder="תיאור מפורט" rows={3} />
                  </div>
                  <div>
                    <Label>מחיר (₪) *</Label>
                    <Input type="number" step="0.01" min="0" value={formData.מחיר_מכירה} onChange={(e) => setFormData({...formData, מחיר_מכירה: e.target.value})} placeholder="0.00" required />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.פעיל} onCheckedChange={(checked) => setFormData({...formData, פעיל: checked})} />
                    <Label>עבודה פעילה</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>ביטול</Button>
                    <Button type="submit" className="bg-purple-600 hover:bg-purple-700">{editingItem ? 'עדכן' : 'צור עבודה'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-gray-400" />
              <Input placeholder="חיפוש עבודה..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>מספר קטלוג</TableHead>
                    <TableHead>שם עבודה</TableHead>
                    <TableHead>תיאור</TableHead>
                    <TableHead>תאריך עדכון</TableHead>
                    <TableHead>מחיר</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead className="text-left">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorks.map((item) => (
                    <TableRow key={item.id} onClick={() => handleEdit(item)} className="cursor-pointer">
                      <TableCell className="font-mono text-sm text-gray-600">{item.מספר_קטלוג || '-'}</TableCell>
                      <TableCell className="font-medium">{item.שם_פריט}</TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs truncate">{item.תיאור || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{item.updated_date ? format(new Date(item.updated_date), 'dd/MM/yyyy HH:mm') : '-'}</TableCell>
                      <TableCell className="font-bold text-green-600">₪{item.מחיר_מכירה?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={item.פעיל ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>{item.פעיל ? 'פעיל' : 'לא פעיל'}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)} className="text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredWorks.length === 0 && <div className="text-center py-8 text-gray-500">{searchTerm ? 'לא נמצאו תוצאות' : 'אין עבודות'}</div>}
            </div>

            <div className="md:hidden divide-y">
              {filteredWorks.map((item) => (
                <div key={item.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => handleEdit(item)}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-gray-900">{item.שם_פריט}</div>
                    <Badge className={item.פעיל ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>{item.פעיל ? 'פעיל' : 'לא פעיל'}</Badge>
                  </div>
                  {item.מספר_קטלוג && <div className="text-xs text-gray-500 mb-2">קטלוג: {item.מספר_קטלוג}</div>}
                  <div className="text-lg font-bold text-green-600 mb-3">₪{item.מחיר_מכירה?.toFixed(2)}</div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(item)} className="flex-1"><Edit className="w-3 h-3 ml-1" />ערוך</Button>
                    <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(item.id)} className="text-red-600 hover:bg-red-50"><Trash2 className="w-3 h-3 ml-1" />מחק</Button>
                  </div>
                </div>
              ))}
              {filteredWorks.length === 0 && <div className="text-center py-8 text-gray-500">{searchTerm ? 'לא נמצאו תוצאות' : 'אין עבודות'}</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}