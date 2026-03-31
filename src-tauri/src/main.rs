#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{ 
    Manager, 
    menu::{Menu, MenuItem}, 
    tray::{TrayIconBuilder, TrayIconEvent}, 
}; 

fn main() { 
    tauri::Builder::default() 
        .setup(|app| { 
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?; 
            let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?; 
            let menu = Menu::with_items(app, &[&open, &quit])?; 

            let _tray = TrayIconBuilder::new() 
                .menu(&menu) 
                .on_menu_event(|app, event| match event.id.as_ref() { 
                    "quit" => app.exit(0), 
                    "open" => { 
                        if let Some(window) = app.get_webview_window("main") { 
                            let _ = window.show(); 
                            let _ = window.set_focus(); 
                        } 
                    } 
                    _ => {} 
                }) 
                .on_tray_icon_event(|tray, event| { 
                    if let TrayIconEvent::Click { .. } = event { 
                        let app = tray.app_handle(); 
                        if let Some(window) = app.get_webview_window("main") { 
                            let _ = window.show(); 
                            let _ = window.set_focus(); 
                        } 
                    } 
                }) 
                .build(app)?; 

            Ok(()) 
        }) 
        .on_window_event(|window, event| { 
            if let tauri::WindowEvent::CloseRequested { api, .. } = event { 
                window.hide().unwrap(); 
                api.prevent_close(); 
            } 
        }) 
        .run(tauri::generate_context!()) 
        .expect("error while running tauri application"); 
}