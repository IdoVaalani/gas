import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return Response.json({ error: 'Missing invoiceId' }, { status: 400 });
    }

    const scannerIP = '10.0.0.16';
    
    // Try multiple possible URLs for the scanner API
    const possibleUrls = [
      `http://${scannerIP}:8080/API/1/Scan`,
      `http://${scannerIP}:80/API/1/Scan`,
      `http://${scannerIP}/API/1/Scan`,
      `http://${scannerIP}:8080/Scan`,
      `http://${scannerIP}/Scan`
    ];

    let scannedData = null;
    let format = 'pdf';
    let connectionError = null;

    for (const url of possibleUrls) {
      try {
        console.log(`Trying URL: ${url}`);
        
        // Try to scan as PDF
        const scanResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            params: {
              FileFormat: 'pdf',
              Resolution: 200,
              ColorMode: 'Grayscale',
              Destination: 'Memory'
            }
          })
        });

        if (scanResponse.ok) {
          const blob = await scanResponse.blob();
          scannedData = new Uint8Array(await blob.arrayBuffer());
          console.log('PDF scan successful');
          break;
        }
      } catch (error) {
        connectionError = error.message;
        console.log(`Failed with ${url}: ${error.message}`);
      }
    }

    // If PDF failed, try JPEG
    if (!scannedData) {
      for (const url of possibleUrls) {
        try {
          const scanResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              params: {
                FileFormat: 'jpeg',
                Resolution: 200,
                ColorMode: 'Grayscale',
                Destination: 'Memory'
              }
            })
          });

          if (scanResponse.ok) {
            const blob = await scanResponse.blob();
            scannedData = new Uint8Array(await blob.arrayBuffer());
            format = 'jpg';
            console.log('JPEG scan successful');
            break;
          }
        } catch (error) {
          connectionError = error.message;
        }
      }
    }

    if (!scannedData) {
      return Response.json(
        { error: 'Scanner not found on network. Make sure it\'s connected and powered on. Last error: ' + connectionError },
        { status: 500 }
      );
    }

    if (!scannedData) {
      return Response.json({ error: 'No scan data received' }, { status: 500 });
    }

    // Upload scanned document to private storage
    const fileName = `scan_${Date.now()}.${format}`;
    const mimeType = format === 'pdf' ? 'application/pdf' : 'image/jpeg';
    
    const file = new File([scannedData], fileName, { type: mimeType });
    const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });

    // Create document record
    const document = await base44.entities.מסמך_חשבונית.create({
      חשבונית_id: invoiceId,
      file_uri: file_uri,
      fileName: fileName,
      description: `סריקה ממכשיר - ${new Date().toLocaleDateString('he-IL')}`,
      תאריך_מסמך: new Date().toISOString().split('T')[0]
    });

    return Response.json({ 
      success: true, 
      document,
      format,
      message: `סריקה בוצעה בהצלחה (${format.toUpperCase()})`
    });

  } catch (error) {
    console.error('Scan error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});