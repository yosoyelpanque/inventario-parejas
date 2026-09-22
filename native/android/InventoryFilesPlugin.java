package io.github.yosoyelpanque.inventarios;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "InventoryFiles")
public class InventoryFilesPlugin extends Plugin {
    private File pending;
    private String exportId;
    private boolean choosing;
    private boolean printing;

    private void clean() {
        if (pending != null) pending.delete();
        pending = null; exportId = null; choosing = false;
    }
    private boolean valid(PluginCall call) {
        if (pending == null || !exportId.equals(call.getString("id"))) {
            call.reject("La exportación ya no está disponible. Vuelve a generarla."); return false;
        }
        return true;
    }
    @PluginMethod public void beginExport(PluginCall call) {
        if (choosing) { call.reject("Termina de guardar el archivo anterior."); return; }
        clean();
        try {
            pending = new File(getContext().getCacheDir(), "inventory-export.tmp");
            new FileOutputStream(pending).close();
            exportId = UUID.randomUUID().toString();
            JSObject result = new JSObject(); result.put("id", exportId); call.resolve(result);
        } catch (Exception e) { clean(); call.reject("No se pudo preparar el archivo.", e); }
    }
    @PluginMethod public void appendExport(PluginCall call) {
        if (!valid(call)) return;
        if (choosing) { call.reject("El archivo ya está listo para guardar."); return; }
        String data = call.getString("data", "");
        if (data.length() > 350000) { call.reject("Fragmento demasiado grande."); return; }
        try (FileOutputStream stream = new FileOutputStream(pending, true)) {
            stream.write(Base64.decode(data, Base64.DEFAULT)); call.resolve();
        } catch (Exception e) { clean(); call.reject("No se pudo preparar el archivo.", e); }
    }
    @PluginMethod public void finishExport(PluginCall call) {
        if (!valid(call)) return;
        if (choosing) { call.reject("Ya hay un guardado abierto."); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "Inventario.zip"));
        choosing = true;
        try { startActivityForResult(call, intent, "documentChosen"); }
        catch (Exception e) { clean(); call.reject("No se pudo abrir el selector de archivos.", e); }
    }
    @ActivityCallback private void documentChosen(PluginCall call, ActivityResult result) {
        if (call == null) { clean(); return; }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            clean(); call.reject("Guardado cancelado."); return;
        }
        if (!valid(call)) { clean(); return; }
        try (FileInputStream input = new FileInputStream(pending);
             OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
            if (output == null) throw new java.io.IOException("Destino no disponible");
            byte[] buffer = new byte[65536]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            output.flush(); call.resolve();
        } catch (Exception e) { call.reject("No se pudo guardar el archivo completo. Vuelve a exportarlo.", e); }
        finally { clean(); }
    }
    @PluginMethod public void cancelExport(PluginCall call) {
        if (!choosing && exportId != null && exportId.equals(call.getString("id"))) clean();
        call.resolve();
    }
    @PluginMethod public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (printing) { call.reject("Ya hay una impresión abierta."); return; }
            printing = true;
            try {
                PrintDocumentAdapter delegate = getBridge().getWebView().createPrintDocumentAdapter("Control de inventarios");
                PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                    @Override public void onStart() { delegate.onStart(); }
                    @Override public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                            CancellationSignal signal, LayoutResultCallback callback, Bundle extras) {
                        delegate.onLayout(oldAttributes, newAttributes, signal, callback, extras);
                    }
                    @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                            CancellationSignal signal, WriteResultCallback callback) {
                        delegate.onWrite(pages, destination, signal, callback);
                    }
                    @Override public void onFinish() { delegate.onFinish(); printing = false; call.resolve(); }
                };
                PrintManager manager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                manager.print("Control de inventarios", adapter, new PrintAttributes.Builder().build());
            } catch (Exception e) { printing = false; call.reject("No se pudo abrir la impresión.", e); }
        });
    }
}
