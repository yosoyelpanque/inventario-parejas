package io.github.yosoyelpanque.inventarios;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(InventoryFilesPlugin.class);
        super.onCreate(state);
    }
}
