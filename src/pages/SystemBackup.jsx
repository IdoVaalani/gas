import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Database, Download, Upload, AlertTriangle, CheckCircle2,
  Loader2, FileDown, FileUp, Shield
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const ENTITY_ORDER = [
  'פריט', 'טכנאי', 'לקוח', 'אתר', 'הזמנת_עבודה',
  'הצעת_מחיר', 'שורת_הצעה', 'חשבונית', 'שורת_חשבונית',
  'תשלום_חשבונית', 'מסמך_חשבונית'
];

const ENTITY_LABELS = {
  'פריט': 'פריטים',
  'טכנאי': 'טכנאים',
  'לקוח': 'לקוחות',
  'אתר': 'אתרים',
  'הזמנת_עבודה': 'הזמנות עבודה',
  'הצעת_מחיר': 'הצעות מחיר',
  'שורת_הצעה': 'שורות הצעה',
  'חשבונית': 'חשבוניות',
  'שורת_חשבונית': 'שורות חשבונית (פריטים ועבודות)',
  'תשלום_חשבונית': 'תשלומים',
  'מסמך_חשבונית': 'מסמכים מצורפים'
};

// קבוצות ישויות קשורות - כשבוחרים קבוצה נבחרות כולן יחד
const ENTITY_GROUPS = [
  {
    label: 'חשבוניות + כל הפרטים שלהן',
    color: 'blue',
    entities: ['חשבונית', 'שורת_חשבונית', 'תשלום_חשבונית', 'מסמך_חשבונית'],
    note: 'כולל שורות פריטים/עבודות, תשלומים ומסמכים'
  },
  {
    label: 'הצעות מחיר + שורותיהן',
    color: 'green',
    entities: ['הצעת_מחיר', 'שורת_הצעה'],
    note: null
  },
  {
    label: 'לקוחות ואתרים',
    color: 'purple',
    entities: ['לקוח', 'אתר'],
    note: null
  },
  {
    label: 'פריטים, טכנאים והזמנות',
    color: 'orange',
    entities: ['פריט', 'טכנאי', 'הזמנת_עבודה'],
    note: null
  }
];

const BATCH_SIZE = 10;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default function SystemBackup() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupFile, setBackupFile] = useState(null);
  const [parsedBackup, setParsedBackup] = useState(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [backupResult, setBackupResult] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [selectedEntities, setSelectedEntities] = useState({});

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupResult(null);
    try {
      const response = await base44.functions.invoke('backupSystem', {});
      const backupData = response.data;
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setBackupResult({
        success: true,
        message: 'הגיבוי הושלם בהצלחה!',
        stats: backupData.metadata
      });
    } catch (error) {
      setBackupResult({ success: false, message: 'שגיאה ביצירת הגיבוי: ' + error.message });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.name.endsWith('.json')) {
      alert('נא לבחור קובץ JSON בלבד');
      e.target.value = null;
      return;
    }
    setBackupFile(file);
    setRestoreResult(null);
    setRestoreProgress(null);
    try {
      const content = await file.text();
      const data = JSON.parse(content);
      setParsedBackup(data);
      // Pre-select all entities that have records
      const initial = {};
      ENTITY_ORDER.forEach(e => {
        initial[e] = (data.data?.[e]?.length || 0) > 0;
      });
      setSelectedEntities(initial);
    } catch (err) {
      alert('קובץ JSON לא תקין: ' + err.message);
      setBackupFile(null);
      setParsedBackup(null);
    }
  };

  const toggleEntity = (entityName) => {
    setSelectedEntities(prev => ({ ...prev, [entityName]: !prev[entityName] }));
  };

  const selectAll = () => {
    const all = {};
    ENTITY_ORDER.forEach(e => { all[e] = (parsedBackup?.data?.[e]?.length || 0) > 0; });
    setSelectedEntities(all);
  };

  const deselectAll = () => {
    const none = {};
    ENTITY_ORDER.forEach(e => { none[e] = false; });
    setSelectedEntities(none);
  };

  const handleRestore = async () => {
    if (!parsedBackup) return;

    const entitiesToRestore = ENTITY_ORDER.filter(e => selectedEntities[e]);
    if (entitiesToRestore.length === 0) {
      alert('יש לבחור לפחות ישות אחת לשחזור');
      return;
    }

    setIsRestoring(true);
    setRestoreResult(null);

    const allData = parsedBackup.data || {};
    const totalRecords = entitiesToRestore.reduce((sum, e) => sum + (allData[e]?.length || 0), 0);
    let doneRecords = 0;

    try {
      for (const entityName of entitiesToRestore) {
        const records = allData[entityName] || [];
        if (records.length === 0) continue;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);
          setRestoreProgress({
            stage: 'משחזר נתונים',
            entityLabel: `${ENTITY_LABELS[entityName] || entityName} (${i + 1}-${Math.min(i + BATCH_SIZE, records.length)} מתוך ${records.length})`,
            step: doneRecords,
            total: totalRecords,
            percent: totalRecords > 0 ? Math.round((doneRecords / totalRecords) * 100) : 0
          });

          await base44.functions.invoke('restoreSystem', {
            phase: 'restore',
            entityName,
            records: batch
          });

          doneRecords += batch.length;
          await sleep(100);
        }
      }

      setRestoreProgress({ stage: 'הושלם!', entityLabel: '', step: totalRecords, total: totalRecords, percent: 100 });
      setRestoreResult({ success: true, message: `השחזור הושלם בהצלחה! שוחזרו ${doneRecords} רשומות.` });
      setShowRestoreDialog(false);
      setBackupFile(null);
      setParsedBackup(null);
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      setRestoreResult({ success: false, message: 'שגיאה בשחזור המערכת: ' + error.message });
      setRestoreProgress(null);
    } finally {
      setIsRestoring(false);
    }
  };

  const selectedCount = Object.values(selectedEntities).filter(Boolean).length;

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-8 h-8 text-blue-600" />
            גיבוי ושחזור מערכת
          </h1>
          <p className="text-gray-600 mt-2">ניהול גיבויים מלאים של כל נתוני המערכת</p>
        </div>

        <Alert className="mb-6 bg-yellow-50 border-yellow-300">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>חשוב!</strong> פעולות גיבוי ושחזור הן פעולות רגישות. מומלץ לבצע גיבוי לפני כל שחזור.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* כרטיס גיבוי */}
          <Card className="shadow-lg border-2 border-blue-200">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <FileDown className="w-6 h-6 text-blue-600" />
                גיבוי מערכת מלא
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-gray-600">מבצע גיבוי של <strong>כל</strong> הרשומות מכל הישויות:</p>
                <ul className="text-sm text-gray-600 space-y-1 mr-4">
                  {ENTITY_ORDER.map(e => (
                    <li key={e}>• {ENTITY_LABELS[e]}</li>
                  ))}
                </ul>
                <Button onClick={handleBackup} disabled={isBackingUp} className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6">
                  {isBackingUp ? <><Loader2 className="w-5 h-5 ml-2 animate-spin" />מכין גיבוי...</> : <><Download className="w-5 h-5 ml-2" />צור גיבוי עכשיו</>}
                </Button>
                {backupResult && (
                  <Alert className={backupResult.success ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}>
                    {backupResult.success ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
                    <AlertDescription className={backupResult.success ? "text-green-800" : "text-red-800"}>
                      {backupResult.message}
                      {backupResult.stats && (
                        <div className="mt-2 text-xs space-y-1">
                          <div>תאריך: {new Date(backupResult.stats.timestamp).toLocaleString('he-IL')}</div>
                          <div>סה"כ רשומות: {backupResult.stats.totalRecords}</div>
                          {backupResult.stats.entityCounts && (
                            <div className="mt-1">
                              {Object.entries(backupResult.stats.entityCounts).map(([e, count]) => (
                                <div key={e}>{ENTITY_LABELS[e] || e}: {count}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* כרטיס שחזור */}
          <Card className="shadow-lg border-2 border-orange-200">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <FileUp className="w-6 h-6 text-orange-600" />
                שחזור מגיבוי
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Alert className="bg-red-50 border-red-300">
                  <Shield className="w-5 h-5 text-red-600" />
                  <AlertDescription className="text-red-800 text-sm">
                    <strong>אזהרה!</strong> השחזור ידרוס נתונים קיימים. בחר בקפידה מה לשחזר.
                  </AlertDescription>
                </Alert>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-orange-500 transition-colors">
                  <Input id="backup-file" type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
                  <Label htmlFor="backup-file" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <div className="text-sm text-gray-600">
                        {backupFile ? <span className="text-blue-600 font-medium">{backupFile.name}</span> : 'לחץ לבחירת קובץ גיבוי (JSON)'}
                      </div>
                    </div>
                  </Label>
                </div>

                {/* בחירת ישויות לשחזור */}
                {parsedBackup && (
                  <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm">בחר מה לשחזר:</span>
                      <div className="flex gap-2">
                        <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">בחר הכל</button>
                        <span className="text-gray-400">|</span>
                        <button onClick={deselectAll} className="text-xs text-red-600 hover:underline">נקה הכל</button>
                      </div>
                    </div>

                    {/* כפתורי בחירה מהירה לפי קבוצות */}
                    <div className="space-y-2">
                      {ENTITY_GROUPS.map((group) => {
                        const groupTotal = group.entities.reduce((s, e) => s + (parsedBackup.data?.[e]?.length || 0), 0);
                        const allSelected = group.entities.every(e => !!selectedEntities[e]);
                        return (
                          <div key={group.label} className="border rounded-lg p-3 bg-white">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-medium text-sm">{group.label}</span>
                                {group.note && <div className="text-xs text-gray-500">{group.note}</div>}
                              </div>
                              <Button
                                size="sm"
                                variant={allSelected ? "default" : "outline"}
                                className={`text-xs h-7 ${allSelected ? 'bg-blue-600' : ''}`}
                                onClick={() => {
                                  const newVal = !allSelected;
                                  setSelectedEntities(prev => {
                                    const updated = { ...prev };
                                    group.entities.forEach(e => { updated[e] = newVal; });
                                    return updated;
                                  });
                                }}
                              >
                                {allSelected ? '✓ נבחר' : 'בחר קבוצה'}
                              </Button>
                            </div>
                            <div className="space-y-1 mr-2">
                              {group.entities.map(entityName => {
                                const count = parsedBackup.data?.[entityName]?.length || 0;
                                return (
                                  <div key={entityName} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`entity-${entityName}`}
                                      checked={!!selectedEntities[entityName]}
                                      onCheckedChange={() => toggleEntity(entityName)}
                                      disabled={count === 0}
                                    />
                                    <Label
                                      htmlFor={`entity-${entityName}`}
                                      className={`flex-1 flex justify-between cursor-pointer text-sm ${count === 0 ? 'text-gray-400' : ''}`}
                                    >
                                      <span>{ENTITY_LABELS[entityName]}</span>
                                      <span className={`text-xs font-mono ${count > 0 ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>{count} רשומות</span>
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2 text-xs text-gray-500 text-center">
                      {selectedCount} ישויות נבחרו | {ENTITY_ORDER.filter(e => selectedEntities[e]).reduce((s, e) => s + (parsedBackup.data?.[e]?.length || 0), 0)} רשומות בסה"כ
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => setShowRestoreDialog(true)}
                  disabled={!parsedBackup || isRestoring || selectedCount === 0}
                  variant="outline"
                  className="w-full border-orange-600 text-orange-600 hover:bg-orange-50 text-lg py-6"
                >
                  <Upload className="w-5 h-5 ml-2" />
                  שחזר {selectedCount > 0 ? `(${selectedCount} ישויות)` : ''}
                </Button>

                {isRestoring && restoreProgress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-700 font-medium">
                      <span>{restoreProgress.stage}</span>
                      <span>{restoreProgress.percent}%</span>
                    </div>
                    {restoreProgress.entityLabel && (
                      <div className="text-xs text-gray-500">{restoreProgress.entityLabel}</div>
                    )}
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div className="bg-orange-500 h-3 rounded-full transition-all duration-300" style={{ width: `${restoreProgress.percent}%` }} />
                    </div>
                  </div>
                )}

                {restoreResult && (
                  <Alert className={restoreResult.success ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}>
                    {restoreResult.success ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
                    <AlertDescription className={restoreResult.success ? "text-green-800" : "text-red-800"}>
                      {restoreResult.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">💡 טיפים חשובים</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✅ בצע גיבוי קבוע של המערכת (מומלץ פעם בשבוע)</li>
              <li>✅ שמור קבצי גיבוי במקום בטוח (Google Drive, Dropbox, וכו')</li>
              <li>✅ ניתן לשחזר ישויות ספציפיות בלבד (למשל, רק חשבוניות)</li>
              <li>✅ הגיבוי שומר את כל ה-IDs המקוריים כך שהקשרים בין הנתונים נשמרים</li>
              <li>⚠️ שחזור מערכת דורש הפעלה מחדש של הדף</li>
            </ul>
          </CardContent>
        </Card>

        {/* דיאלוג אישור שחזור */}
        <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-6 h-6" />
                אישור שחזור מערכת
              </DialogTitle>
              <DialogDescription className="space-y-3 pt-4">
                <Alert className="bg-red-50 border-red-300">
                  <AlertDescription className="text-red-800">
                    <strong>אזהרה!</strong> פעולה זו תדרוס נתונים קיימים מהישויות שנבחרו.
                  </AlertDescription>
                </Alert>
                <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-1">
                  <div className="font-medium mb-2">ישויות לשחזור:</div>
                  {ENTITY_ORDER.filter(e => selectedEntities[e]).map(e => (
                    <div key={e} className="flex justify-between">
                      <span>{ENTITY_LABELS[e]}</span>
                      <span className="text-gray-500">{parsedBackup?.data?.[e]?.length || 0} רשומות</span>
                    </div>
                  ))}
                </div>
                <p className="text-gray-700">האם אתה בטוח שברצונך להמשיך?</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowRestoreDialog(false)} disabled={isRestoring}>ביטול</Button>
              <Button onClick={handleRestore} disabled={isRestoring} className="bg-red-600 hover:bg-red-700">
                {isRestoring ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />משחזר...</> : <><Shield className="w-4 h-4 ml-2" />כן, שחזר</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}