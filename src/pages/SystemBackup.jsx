import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Database, 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle2,
  Loader2,
  FileDown,
  FileUp,
  Shield
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SystemBackup() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupFile, setBackupFile] = useState(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [backupResult, setBackupResult] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(null); // { stage, step, total }

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupResult(null);
    
    try {
      const response = await base44.functions.invoke('backupSystem', {});
      
      // יצירת קובץ JSON להורדה
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
      console.error('Backup error:', error);
      setBackupResult({
        success: false,
        message: 'שגיאה ביצירת הגיבוי: ' + error.message
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.json')) {
      setBackupFile(file);
    } else {
      alert('נא לבחור קובץ JSON בלבד');
      e.target.value = null;
    }
  };

  const restoreOrder = [
    'פריט', 'טכנאי', 'לקוח', 'אתר', 'הזמנת_עבודה',
    'הצעת_מחיר', 'שורת_הצעה', 'חשבונית', 'שורת_חשבונית',
    'תשלום_חשבונית', 'מסמך_חשבונית'
  ];

  const entityLabels = {
    'פריט': 'פריטים', 'טכנאי': 'טכנאים', 'לקוח': 'לקוחות',
    'אתר': 'אתרים', 'הזמנת_עבודה': 'הזמנות עבודה', 'הצעת_מחיר': 'הצעות מחיר',
    'שורת_הצעה': 'שורות הצעה', 'חשבונית': 'חשבוניות', 'שורת_חשבונית': 'שורות חשבונית',
    'תשלום_חשבונית': 'תשלומים', 'מסמך_חשבונית': 'מסמכים'
  };

  const handleRestore = async () => {
    if (!backupFile) {
      alert('נא לבחור קובץ גיבוי');
      return;
    }

    setIsRestoring(true);
    setRestoreResult(null);
    setRestoreProgress(null);
    
    try {
      const fileContent = await backupFile.text();
      const backupData = JSON.parse(fileContent);
      
      const allEntities = restoreOrder;
      const totalSteps = allEntities.length * 2; // מחיקה + שחזור
      let currentStep = 0;

      // שחזור בלבד (update/create) - ללא מחיקה
      let step2 = allEntities.length;
      for (const entityName of allEntities) {
        step2++;
        setRestoreProgress({
          stage: 'משחזר נתונים',
          entityLabel: entityLabels[entityName] || entityName,
          step: step2,
          total: totalSteps,
          percent: Math.round((step2 / totalSteps) * 100)
        });
        await base44.functions.invoke('restoreSystem', { backupData, phase: 'restore', entityName });
      }

      setRestoreProgress({ stage: 'הושלם!', entityLabel: '', step: totalSteps, total: totalSteps, percent: 100 });
      
      setRestoreResult({
        success: true,
        message: 'השחזור הושלם בהצלחה!'
      });
      
      setShowRestoreDialog(false);
      setBackupFile(null);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Restore error:', error);
      setRestoreResult({
        success: false,
        message: 'שגיאה בשחזור המערכת: ' + error.message
      });
      setRestoreProgress(null);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-8 h-8 text-blue-600" />
            גיבוי ושחזור מערכת
          </h1>
          <p className="text-gray-600 mt-2">
            ניהול גיבויים מלאים של כל נתוני המערכת
          </p>
        </div>

        {/* אזהרת בטיחות */}
        <Alert className="mb-6 bg-yellow-50 border-yellow-300">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>חשוב!</strong> פעולות גיבוי ושחזור הן פעולות רגישות.
            <br />
            • גיבוי מערכת יוריד קובץ עם כל הנתונים שלך
            <br />
            • שחזור מערכת ימחק את כל הנתונים הנוכחיים וישחזר מהגיבוי
            <br />
            • מומלץ לבצע גיבוי לפני כל שחזור
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
                <p className="text-gray-600">
                  יצירת גיבוי מלא של כל נתוני המערכת:
                </p>
                <ul className="text-sm text-gray-600 space-y-2 mr-6">
                  <li>• כל הלקוחות והאתרים</li>
                  <li>• כל הטכנאים</li>
                  <li>• כל החשבוניות וההצעות</li>
                  <li>• כל הפריטים והעבודות</li>
                  <li>• כל התשלומים והמסמכים</li>
                </ul>
                
                <Button
                  onClick={handleBackup}
                  disabled={isBackingUp}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
                >
                  {isBackingUp ? (
                    <>
                      <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                      מכין גיבוי...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 ml-2" />
                      צור גיבוי עכשיו
                    </>
                  )}
                </Button>

                {backupResult && (
                  <Alert className={backupResult.success ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}>
                    {backupResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    )}
                    <AlertDescription className={backupResult.success ? "text-green-800" : "text-red-800"}>
                      {backupResult.message}
                      {backupResult.stats && (
                        <div className="mt-2 text-xs">
                          <div>תאריך: {backupResult.stats.timestamp}</div>
                          <div>סה"כ רשומות: {backupResult.stats.totalRecords}</div>
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
                שחזור מערכת מגיבוי
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Alert className="bg-red-50 border-red-300">
                  <Shield className="w-5 h-5 text-red-600" />
                  <AlertDescription className="text-red-800 text-sm">
                    <strong>אזהרה!</strong> פעולה זו תמחק את כל הנתונים הנוכחיים ותשחזר מהגיבוי.
                  </AlertDescription>
                </Alert>

                <p className="text-gray-600 text-sm">
                  בחר קובץ גיבוי (JSON) לשחזור המערכת:
                </p>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-orange-500 transition-colors">
                  <Input
                    id="backup-file"
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Label htmlFor="backup-file" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <div className="text-sm text-gray-600">
                        {backupFile ? (
                          <span className="text-blue-600 font-medium">{backupFile.name}</span>
                        ) : (
                          'לחץ לבחירת קובץ גיבוי'
                        )}
                      </div>
                    </div>
                  </Label>
                </div>

                <Button
                  onClick={() => setShowRestoreDialog(true)}
                  disabled={!backupFile || isRestoring}
                  variant="outline"
                  className="w-full border-orange-600 text-orange-600 hover:bg-orange-50 text-lg py-6"
                >
                  <Upload className="w-5 h-5 ml-2" />
                  שחזר מערכת
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
                      <div
                        className="bg-orange-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${restoreProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {restoreResult && (
                  <Alert className={restoreResult.success ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}>
                    {restoreResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    )}
                    <AlertDescription className={restoreResult.success ? "text-green-800" : "text-red-800"}>
                      {restoreResult.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* מידע נוסף */}
        <Card className="shadow-lg bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">💡 טיפים חשובים</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✅ בצע גיבוי קבוע של המערכת (מומלץ פעם בשבוע)</li>
              <li>✅ שמור קבצי גיבוי במקום בטוח (Google Drive, Dropbox, וכו')</li>
              <li>✅ שם הקובץ כולל את התאריך והשעה ליצירה נוחה</li>
              <li>✅ לפני שחזור - בדוק שהקובץ תקין ומהמקור הנכון</li>
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
                    <strong>אזהרה חמורה!</strong>
                    <br />
                    פעולה זו תמחק את <strong>כל הנתונים</strong> הנוכחיים במערכת ותשחזר מהגיבוי.
                  </AlertDescription>
                </Alert>

                <div className="bg-gray-50 p-4 rounded-lg text-sm">
                  <div className="font-medium mb-2">קובץ גיבוי:</div>
                  <div className="text-gray-600">{backupFile?.name}</div>
                </div>

                <p className="text-gray-700">
                  האם אתה בטוח שברצונך להמשיך?
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRestoreDialog(false)}
                disabled={isRestoring}
              >
                ביטול
              </Button>
              <Button
                onClick={handleRestore}
                disabled={isRestoring}
                className="bg-red-600 hover:bg-red-700"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    משחזר...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 ml-2" />
                    כן, שחזר מערכת
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}