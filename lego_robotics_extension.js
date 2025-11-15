(function(Scratch) {
  'use strict';

  const Cast = Scratch.Cast;

  // LEGO Spike Prime BLE UUIDs (aus offizieller Dokumentation)
  const SPIKE_SERVICE_UUID = '00001623-1212-efde-1623-785feabcd123';
  const SPIKE_TX_UUID = '00001624-1212-efde-1623-785feabcd123';
  const SPIKE_RX_UUID = '00001625-1212-efde-1623-785feabcd123';

  class LEGORobotics {
    constructor() {
      this.device = null;
      this.deviceType = null;
      this.connected = false;
      this.server = null;
      this.service = null;
      this.txCharacteristic = null; // notifications from hub
      this.rxCharacteristic = null; // writes to hub
      this.motors = {};
      this.sensors = {};
      this.sensorData = {};
      this.batteryLevel = 0;
      this.hubName = '';
      this.messageQueue = [];
      this.processing = false;

      // For NXT responses
      this._nxtResponseResolver = null;
      this._nxtResponseTimeout = 3000; // ms
    }

    getInfo() {
      return {
        id: 'legorobotics',
        name: 'LEGO Robotics',
        color1: '#FF6B00',
        color2: '#E85D00',
        color3: '#CC5200',
        blocks: [
          {
            blockType: Scratch.BlockType.LABEL,
            text: '🔌 Verbindung'
          },
          {
            opcode: 'connectDevice',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Verbinde [DEVICE]',
            arguments: {
              DEVICE: {
                type: Scratch.ArgumentType.STRING,
                menu: 'deviceMenu'
              }
            }
          },
          {
            opcode: 'disconnect',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Trenne Verbindung'
          },
          {
            opcode: 'isConnected',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'Verbunden?'
          },
          {
            opcode: 'getHubName',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Hub-Name'
          },
          {
            opcode: 'getBatteryLevel',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Batterie-Level (%)'
          },
          {
            blockType: Scratch.BlockType.LABEL,
            text: '⚙️ Motoren'
          },
          {
            opcode: 'setMotorPower',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Motor [PORT] auf [POWER]% Leistung',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              },
              POWER: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 50
              }
            }
          },
          {
            opcode: 'runMotorForDegrees',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Drehe Motor [PORT] um [DEGREES]° mit [POWER]%',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              },
              DEGREES: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 360
              },
              POWER: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 50
              }
            }
          },
          {
            opcode: 'runMotorForSeconds',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Motor [PORT] für [SECONDS] Sekunden mit [POWER]%',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              },
              SECONDS: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 1
              },
              POWER: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 50
              }
            }
          },
          {
            opcode: 'stopMotor',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Stoppe Motor [PORT] [BRAKE]',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              },
              BRAKE: {
                type: Scratch.ArgumentType.STRING,
                menu: 'brakeMenu',
                defaultValue: 'brake'
              }
            }
          },
          {
            opcode: 'stopAllMotors',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Stoppe alle Motoren [BRAKE]',
            arguments: {
              BRAKE: {
                type: Scratch.ArgumentType.STRING,
                menu: 'brakeMenu',
                defaultValue: 'brake'
              }
            }
          },
          {
            opcode: 'getMotorPosition',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Motor [PORT] Position (Grad)',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              }
            }
          },
          {
            opcode: 'resetMotorPosition',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Setze Motor [PORT] Position zurück',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              }
            }
          },
          {
            blockType: Scratch.BlockType.LABEL,
            text: '🔍 Sensoren'
          },
          {
            opcode: 'getColorSensor',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Farbsensor [PORT] erkannte Farbe',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              }
            }
          },
          {
            opcode: 'getColorReflection',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Farbsensor [PORT] Helligkeit (0-100)',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              }
            }
          },
          {
            opcode: 'getDistanceSensor',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Distanzsensor [PORT] Entfernung (cm)',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              }
            }
          },
          {
            opcode: 'getForceSensor',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Kraftsensor [PORT] Kraft (N)',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              }
            }
          },
          {
            opcode: 'isForceSensorPressed',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'Kraftsensor [PORT] gedrückt?',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu'
              }
            }
          },
          {
            blockType: Scratch.BlockType.LABEL,
            text: '🤖 Hub (Spike Prime)'
          },
          {
            opcode: 'setHubPixel',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Hub LED [X],[Y] auf Helligkeit [BRIGHTNESS]',
            arguments: {
              X: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 2
              },
              Y: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 2
              },
              BRIGHTNESS: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 9
              }
            }
          },
          {
            opcode: 'setHubLightColor',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Hub Status-LED auf [COLOR]',
            arguments: {
              COLOR: {
                type: Scratch.ArgumentType.STRING,
                menu: 'colorMenu'
              }
            }
          },
          {
            opcode: 'playTone',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Spiele Ton [NOTE] für [DURATION] ms',
            arguments: {
              NOTE: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 60
              },
              DURATION: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 500
              }
            }
          },
          {
            opcode: 'getHubGesture',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Hub Bewegung/Geste'
          },
          {
            opcode: 'getHubOrientation',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Hub Orientierung'
          },
          {
            blockType: Scratch.BlockType.LABEL,
            text: '🔧 NXT Spezifisch'
          },
          {
            opcode: 'nxtPlaySound',
            blockType: Scratch.BlockType.COMMAND,
            text: '[NXT] Ton [FREQ] Hz für [MS] ms',
            arguments: {
              FREQ: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 440
              },
              MS: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 500
              }
            }
          },
          {
            opcode: 'nxtGetBattery',
            blockType: Scratch.BlockType.REPORTER,
            text: '[NXT] Batterie (mV)'
          }
        ],
        menus: {
          deviceMenu: {
            acceptReporters: false,
            items: ['Spike Prime', 'Spike Essential', 'NXT']
          },
          portMenu: {
            acceptReporters: true,
            items: ['A', 'B', 'C', 'D', 'E', 'F']
          },
          brakeMenu: {
            acceptReporters: false,
            items: [
              {text: 'mit Bremse', value: 'brake'},
              {text: 'auslaufen', value: 'coast'}
            ]
          },
          colorMenu: {
            acceptReporters: true,
            items: ['schwarz', 'pink', 'violett', 'blau', 'hellblau', 'türkis', 
                    'grün', 'gelb', 'orange', 'rot', 'weiß']
          }
        }
      };
    }

    // ========== VERBINDUNG ==========
    
    async connectDevice(args) {
      const deviceName = Cast.toString(args.DEVICE);
      
      try {
        if (!navigator.bluetooth) {
          alert('Web Bluetooth wird nicht unterstützt. Bitte nutze Chrome, Edge oder Opera.');
          return;
        }

        if (deviceName.includes('Spike')) {
          await this.connectSpike(deviceName);
        } else if (deviceName === 'NXT') {
          await this.connectNXT();
        }
      } catch (error) {
        console.error('Verbindungsfehler:', error);
        alert(`Verbindung fehlgeschlagen: ${error.message}`);
        this.connected = false;
      }
    }

    async connectSpike(deviceName) {
      console.log('Suche nach Spike Prime/Essential...');
      
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'LEGO Hub' }],
        optionalServices: [SPIKE_SERVICE_UUID]
      });

      this.deviceType = deviceName.includes('Essential') ? 'spike-essential' : 'spike-prime';
      this.hubName = this.device.name;

      console.log('Verbinde mit:', this.hubName);
      this.server = await this.device.gatt.connect();
      
      this.service = await this.server.getPrimaryService(SPIKE_SERVICE_UUID);
      this.txCharacteristic = await this.service.getCharacteristic(SPIKE_TX_UUID);
      this.rxCharacteristic = await this.service.getCharacteristic(SPIKE_RX_UUID);

      // Aktiviere Benachrichtigungen
      await this.txCharacteristic.startNotifications();
      this.txCharacteristic.addEventListener('characteristicvaluechanged', 
        this.handleSpikeNotification.bind(this));

      this.connected = true;
      console.log('✓ Verbunden mit', this.hubName);
      
      // Anfrage Hub-Info senden (JSON-Protokoll falls unterstützt)
      await this.sendSpikeJSON({m: 'get_hub_info'});

      // Optional: subscribe to common ports for notifications
      this.subscribeToAllPorts();
    }

    async connectNXT() {
      console.log('Suche nach NXT...');
      
      // Hinweis: NXT verwendet Bluetooth Classic (RFCOMM / SPP). Web Bluetooth (Gatt) unterstützt
      // Bluetooth Classic normalerweise nicht. Wir versuchen trotzdem, ein GATT-Gerät zu verbinden
      // falls ein BLE-Adapter/Bridge vorhanden ist. Andernfalls muss eine Proxy-Lösung (z.B. WebSerial
      // an einen seriellen Bluetooth-Adapter) verwendet werden.

      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'NXT' }],
        // optionalServices left empty because classic SPP UUID is not a GATT service
      });

      this.deviceType = 'nxt';
      this.hubName = this.device.name;
      
      console.log('Verbinde mit:', this.hubName);
      this.server = await this.device.gatt.connect();

      // Versuche, eine schreibbare Characteristic zu finden (falls der NXT über eine BLE-Bridge
      // verfügbar gemacht wurde). Falls nicht, informieren wir den Nutzer.
      try {
        const services = await this.server.getPrimaryServices();
        for (const svc of services) {
          try {
            const chars = await svc.getCharacteristics();
            for (const c of chars) {
              // heuristisch: suche nach write- oder notify-fähigen Characteristics
              if (c.properties.write && !this.rxCharacteristic) this.rxCharacteristic = c;
              if (c.properties.notify && !this.txCharacteristic) this.txCharacteristic = c;
            }
          } catch (e) {
            // ignore characteristics enumeration errors for this service
          }
        }

        if (this.txCharacteristic) {
          await this.txCharacteristic.startNotifications();
          this.txCharacteristic.addEventListener('characteristicvaluechanged', ev => {
            this.handleNxtNotification(ev);
          });
        }

        if (!this.rxCharacteristic) {
          console.warn('Keine schreibbare Characteristic gefunden. NXT über Web Bluetooth (GATT) ' +
            'wird wahrscheinlich nicht unterstützt. Verwende eine Proxy-Lösung (z.B. serieller ' +
            'Bluetooth-Adapter + WebSerial) oder einen BLE-zu-RFCOMM-Bridge.');
        }

        this.connected = true;
        console.log('✓ Verbunden mit NXT (GATT-Bridge gefunden:', !!this.rxCharacteristic, ')');
      } catch (e) {
        console.warn('Fehler beim Enumerieren der GATT-Services/Characteristics:', e);
        this.connected = true; // Wir setzen connected, aber viele Funktionen sind eventuell nicht verfügbar
      }

      // Hinweis: Wenn kein GATT-Bridge vorhanden ist, funktionieren die NXT-spezifischen Befehle
      // nicht über Web Bluetooth. Sie sind implementiert, falls eine Bridge/Adapter vorhanden ist.
    }

    disconnect() {
      if (this.device && this.device.gatt.connected) {
        this.device.gatt.disconnect();
        this.connected = false;
        this.device = null;
        this.server = null;
        console.log('Verbindung getrennt');
      }
    }

    isConnected() {
      return this.connected && this.device && this.device.gatt.connected;
    }

    getHubName() {
      return this.hubName || 'Nicht verbunden';
    }

    getBatteryLevel() {
      return this.batteryLevel;
    }

    // ========== SPIKE PRIME KOMMUNIKATION ==========

    // Sendet eine JSON-Nachricht (neues/älteres Spike-REPL/mailbox Protokoll)
    async sendSpikeJSON(obj) {
      if (!this.isConnected() || !this.deviceType.includes('spike')) return;
      try {
        const jsonMsg = JSON.stringify(obj) + '\r';
        const encoder = new TextEncoder();
        const data = encoder.encode(jsonMsg);
        await this.rxCharacteristic.writeValue(data);
      } catch (error) {
        console.error('Fehler beim Senden JSON:', error);
      }
    }

    // Sendet rohe Bytes an die RX-Characteristic (für Bridge/Binary-Protokoll)
    async sendSpikeRaw(bytes) {
      if (!this.isConnected() || !this.deviceType.includes('spike')) return;
      if (!this.rxCharacteristic) return;
      try {
        // Bei manchen Bridges ist ein 2-Byte-Längenpräfix nötig; versuchen wir ohne und mit Präfix.
        try {
          await this.rxCharacteristic.writeValue(bytes);
        } catch (e) {
          // fallback mit 2-Byte length prefix (Little Endian)
          const packet = new Uint8Array(2 + bytes.length);
          packet[0] = bytes.length & 0xFF;
          packet[1] = (bytes.length >> 8) & 0xFF;
          packet.set(bytes, 2);
          await this.rxCharacteristic.writeValue(packet);
        }
      } catch (error) {
        console.error('Fehler beim Senden Raw:', error);
      }
    }

    // Abstraktion: Sende einen Port-Befehl (verwende JSON-API, da das in vielen Setups funktioniert)
    async sendPortCommand(port, params) {
      if (!this.isConnected() || !this.deviceType.includes('spike')) return;
      const cmd = {
        m: 'port_command',
        p: Object.assign({port: port}, params)
      };
      await this.sendSpikeJSON(cmd);
    }

    // Abonniere alle Ports sinnvollerweise zum Erhalt von Notifications
    async subscribeToAllPorts() {
      // Spike sendet port_notifications für konfigurierte Ports. Wir versuchen, die üblichen Ports zu abonnieren.
      const ports = ['A','B','C','D','E','F'];
      for (const port of ports) {
        // Bitte beachten: Das eigentliche 'subscribe' ist hardwareabhängig; wir senden eine Anfrage
        // an den Hub, damit dieser Port mit Notifications versehen wird (einige Hubs tun das automatisch).
        try {
          await this.sendSpikeJSON({m: 'port_subscribe', p: {port: port}});
        } catch (e) {
          // ignore
        }
      }
    }

    // Verarbeite Notifications vom Spike Hub (JSON oder binär)
    handleSpikeNotification(event) {
      const decoder = new TextDecoder();
      let value;

      try {
        // Versuche JSON-Parsing (Text-Protokoll)
        value = decoder.decode(event.target.value);
        const data = JSON.parse(value);

        if (data.m === 'hub_info') {
          // battery in percent oder mV je nach Implementation
          this.batteryLevel = data.p?.battery || this.batteryLevel;
          if (data.p?.name) this.hubName = data.p.name;
        } else if (data.m === 'port_notification') {
          const port = data.p?.port;
          const values = data.p?.values;
          if (port && values) {
            this.sensorData[port] = values;
          }
        } else if (data.m === 'port_info') {
          // port meta information
          const port = data.p?.port;
          if (port) this.sensors[port] = data.p;
        }
        return;
      } catch (e) {
        // Nicht-JSON — versuche binäres Parsen weiter unten
      }

      // Falls das Payload kein JSON war, behandeln wir es als binär (Bridge-Mode)
      try {
        const buf = event.target.value.buffer ? event.target.value.buffer : event.target.value;
        const bytes = new Uint8Array(buf);
        if (bytes.length === 0) return;

        // Heuristische Auswertung: Viele Bridges liefern ein 2-Byte-Längenpräfix
        let offset = 0;
        if (bytes.length >= 2) {
          const len = bytes[0] | (bytes[1] << 8);
          if (len === bytes.length - 2) offset = 2;
        }

        // Simplifiziertes Parsing: Suche nach Port-Notification (0x04 op code in some implementations)
        // Da verschiedene Bridges unterschiedliche Protokolle verwenden, parsen wir allgemein:
        // Wenn Payload Byte 0 == 0x01 (hub info) oder 0x04 (port notification) - heuristisch
        const b0 = bytes[offset];
        if (b0 === 0x01) {
          // Beispiel: hub info -> next bytes could contain battery
          if (bytes.length >= offset + 3) {
            this.batteryLevel = bytes[offset + 1];
          }
        } else if (b0 === 0x04 || b0 === 0x05 || b0 === 0x06) {
          // port notification like: [op, portByte, type, ...values]
          const portByte = bytes[offset + 1];
          const port = String.fromCharCode(65 + (portByte & 0x07)); // A..G
          // simple value extraction: next byte as value
          const val = bytes[offset + 2];
          this.sensorData[port] = [val];
        } else {
          // fallback: store raw bytes under key 'raw'
          this.sensorData['raw'] = Array.from(bytes.slice(offset));
        }
      } catch (err) {
        console.warn('Konnte Spike Notification nicht parsen:', err);
      }
    }

    // ========== MOTOREN ==========

    async setMotorPower(args) {
      if (!this.isConnected()) return;
      
      const port = Cast.toString(args.PORT).toUpperCase();
      let power = Math.max(-100, Math.min(100, Cast.toNumber(args.POWER)));

      if (this.deviceType.includes('spike')) {
        await this.sendPortCommand(port, {mode: 'pwm', power: power});
      } else if (this.deviceType === 'nxt') {
        await this.nxtSetMotorPower(port, power);
      }
    }

    async runMotorForDegrees(args) {
      if (!this.isConnected()) return;
      
      const port = Cast.toString(args.PORT).toUpperCase();
      const degrees = Cast.toNumber(args.DEGREES);
      let power = Math.max(-100, Math.min(100, Cast.toNumber(args.POWER)));

      if (this.deviceType.includes('spike')) {
        await this.sendPortCommand(port, {mode: 'position', position: degrees, speed: power});
      }
    }

    async runMotorForSeconds(args) {
      if (!this.isConnected()) return;
      
      const port = Cast.toString(args.PORT).toUpperCase();
      const seconds = Math.max(0, Cast.toNumber(args.SECONDS));
      const power = Math.max(-100, Math.min(100, Cast.toNumber(args.POWER)));

      await this.setMotorPower({PORT: port, POWER: power});
      
      return new Promise(resolve => {
        setTimeout(async () => {
          await this.stopMotor({PORT: port, BRAKE: 'brake'});
          resolve();
        }, seconds * 1000);
      });
    }

    async stopMotor(args) {
      if (!this.isConnected()) return;
      
      const port = Cast.toString(args.PORT).toUpperCase();
      const brake = Cast.toString(args.BRAKE);

      if (this.deviceType.includes('spike')) {
        await this.sendPortCommand(port, {mode: brake === 'brake' ? 'brake' : 'coast'});
      } else if (this.deviceType === 'nxt') {
        await this.nxtSetMotorPower(port, 0);
      }
    }

    async stopAllMotors(args) {
      const brake = Cast.toString(args.BRAKE);
      const ports = ['A', 'B', 'C', 'D', 'E', 'F'];
      
      for (const port of ports) {
        await this.stopMotor({PORT: port, BRAKE: brake});
      }
    }

    getMotorPosition(args) {
      const port = Cast.toString(args.PORT).toUpperCase();
      return this.sensorData[port]?.[0] || 0;
    }

    async resetMotorPosition(args) {
      if (!this.isConnected() || !this.deviceType.includes('spike')) return;
      
      const port = Cast.toString(args.PORT).toUpperCase();
      await this.sendPortCommand(port, {mode: 'reset'});
    }

    // ========== SENSOREN ==========

    getColorSensor(args) {
      const port = Cast.toString(args.PORT).toUpperCase();
      const colors = ['schwarz', 'violett', 'blau', 'türkis', 'grün', 
                      'gelb', 'rot', 'weiß', 'keine Farbe'];
      const colorIndex = this.sensorData[port]?.[0] || 0;
      return colors[colorIndex] || 'unbekannt';
    }

    getColorReflection(args) {
      const port = Cast.toString(args.PORT).toUpperCase();
      return this.sensorData[port]?.[0] || 0;
    }

    getDistanceSensor(args) {
      const port = Cast.toString(args.PORT).toUpperCase();
      const distance = this.sensorData[port]?.[0] || 0;
      return Math.round(distance / 10); // mm zu cm
    }

    getForceSensor(args) {
      const port = Cast.toString(args.PORT).toUpperCase();
      return (this.sensorData[port]?.[0] || 0) / 10;
    }

    isForceSensorPressed(args) {
      const port = Cast.toString(args.PORT).toUpperCase();
      return (this.sensorData[port]?.[0] || 0) > 5;
    }

    // ========== HUB STEUERUNG ==========

    async setHubPixel(args) {
      if (!this.isConnected() || !this.deviceType.includes('spike')) return;
      
      const x = Math.max(0, Math.min(4, Cast.toNumber(args.X)));
      const y = Math.max(0, Math.min(4, Cast.toNumber(args.Y)));
      const brightness = Math.max(0, Math.min(9, Cast.toNumber(args.BRIGHTNESS)));

      await this.sendSpikeJSON({m: 'display_set_pixel', p: {x: x, y: y, brightness: brightness}});
    }

    async setHubLightColor(args) {
      if (!this.isConnected() || !this.deviceType.includes('spike')) return;
      
      const colorMap = {
        'schwarz': 0, 'pink': 1, 'violett': 2, 'blau': 3,
        'hellblau': 4, 'türkis': 5, 'grün': 6, 'gelb': 7,
        'orange': 8, 'rot': 9, 'weiß': 10
      };
      
      const color = Cast.toString(args.COLOR).toLowerCase();
      const colorIndex = colorMap[color] || 0;

      await this.sendSpikeJSON({m: 'hub_led', p: {color: colorIndex}});
    }

    async playTone(args) {
      if (!this.isConnected() || !this.deviceType.includes('spike')) return;
      
      const note = Cast.toNumber(args.NOTE);
      const duration = Cast.toNumber(args.DURATION);

      await this.sendSpikeJSON({m: 'play_sound', p: {note: note, duration: duration}});
    }

    getHubGesture() {
      const gestures = ['keine', 'geschüttelt', 'gekippt', 'freier Fall', 'gedreht'];
      return gestures[this.sensorData['gesture'] || 0];
    }

    getHubOrientation() {
      const orientations = ['flach', 'aufrecht', 'auf dem Kopf', 'links', 'rechts', 'vorne'];
      return orientations[this.sensorData['orientation'] || 0];
    }

    // ========== NXT SPEZIFISCH ==========

    // Hilfsfunktion: sendet ein Byte-Array an die (Bridge-)Characteristic mit optionaler Längen-Präfix
    async _sendToNxtCharacteristic(commandBytes, withLengthPrefix = true) {
      if (!this.rxCharacteristic) {
        console.warn('Keine schreibbare NXT-Characteristic verfügbar. Befehl nicht gesendet.');
        return;
      }

      let packet;
      if (withLengthPrefix) {
        const len = commandBytes.length;
        packet = new Uint8Array(2 + commandBytes.length);
        packet[0] = len & 0xFF;
        packet[1] = (len >> 8) & 0xFF;
        packet.set(commandBytes, 2);
      } else {
        packet = commandBytes;
      }

      try {
        await this.rxCharacteristic.writeValue(packet);
      } catch (e) {
        console.error('Fehler beim Schreiben an NXT-Characteristic:', e);
      }
    }

    async nxtSetMotorPower(port, power) {
      // NXT Direct Command Format
      const portMap = {'A': 0x00, 'B': 0x01, 'C': 0x02};
      const portByte = portMap[port] || 0x00;
      const powerByte = ((power & 0xFF) >>> 0);
      
      const command = new Uint8Array([
        0x80, // Command ohne Antwort
        0x04, // SETOUTPUTSTATE
        portByte,
        powerByte,
        0x01, // Mode: Motor On
        0x00, // Regulation Mode
        0x00, // Turn Ratio
        0x20, // Run State: Running
        0x00, 0x00, 0x00, 0x00 // Tacho Limit
      ]);
      
      // Senden über (Bridge-)Characteristic falls vorhanden
      await this._sendToNxtCharacteristic(command, true);
      console.log('NXT Command gesendet (versucht):', command);
    }

    async nxtPlaySound(args) {
      if (!this.isConnected() || this.deviceType !== 'nxt') return;
      
      const freq = Cast.toNumber(args.FREQ);
      const ms = Cast.toNumber(args.MS);
      
      const command = new Uint8Array([
        0x80, // Command ohne Antwort
        0x03, // PLAYTONE
        freq & 0xFF, (freq >> 8) & 0xFF,
        ms & 0xFF, (ms >> 8) & 0xFF
      ]);
      
      await this._sendToNxtCharacteristic(command, true);
      console.log('NXT Play Tone gesendet:', freq, 'Hz für', ms, 'ms');
    }

    // Empfange Notification/Antworten von NXT-Bridge
    handleNxtNotification(event) {
      const data = new Uint8Array(event.target.value.buffer);
      // Wenn die Bridge das Protokoll verwendet, ist typischerweise ein 2-Byte-Längenfeld vorangestellt
      if (data.length >= 3) {
        // Versuche, die Nutzdaten nach Längen-Präfix zu extrahieren
        const len = data[0] | (data[1] << 8);
        const payload = data.slice(2, 2 + len);
        // Wenn ein Resolver wartet (z.B. nxtGetBattery), löse ihn mit payload
        if (this._nxtResponseResolver) {
          const resolver = this._nxtResponseResolver;
          this._nxtResponseResolver = null;
          resolver(payload);
        }
      } else {
        // Direct payload (keine Längen-Präfix)
        if (this._nxtResponseResolver) {
          const resolver = this._nxtResponseResolver;
          this._nxtResponseResolver = null;
          resolver(data);
        }
      }
    }

    async nxtGetBattery() {
      if (!this.isConnected() || this.deviceType !== 'nxt') return 0;
      
      // GETBATTERYLEVEL: Command mit Antwort
      const command = new Uint8Array([
        0x00, // Command mit Antwort
        0x0B  // GETBATTERYLEVEL
      ]);

      // Schreib die Anfrage und warte auf die Antwort (falls Notifications verfügbar sind)
      if (!this.txCharacteristic) {
        console.warn('Keine notify-Characteristic gefunden. Rückgabe 0.');
        return 0;
      }

      const response = await new Promise(resolve => {
        let resolved = false;
        this._nxtResponseResolver = payload => {
          if (resolved) return;
          resolved = true;
          resolve(payload);
        };

        // Timeout
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this._nxtResponseResolver = null;
            resolve(null);
          }
        }, this._nxtResponseTimeout);

        // Senden
        this._sendToNxtCharacteristic(command, true);
      });

      if (!response) return 0;

      // Die Antwort payload enthält typischerweise: [commandType, opCode, <data...>]
      // Für GETBATTERYLEVEL sollte das Batterie-Level als 2-Byte Little Endian an Position 2/3 stehen.
      if (response.length >= 4) {
        const battery = response[2] | (response[3] << 8);
        return battery;
      }

      return 0;
    }
  }

  Scratch.extensions.register(new LEGORobotics());
})(Scratch);