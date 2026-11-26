import { webview } from '@kit.ArkWeb';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { fileIo as fs } from '@kit.CoreFileKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const TAG: string = 'DreikanterWeb';
const DOMAIN: number = 0x0001;

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  @State private ready: boolean = false;

  /* 把相册里选中的图片复制到沙箱，再交给 <input type=file> */
  private async pickIntoFileSelector(event: FileSelectorParam): Promise<void> {
    try {
      const picker = new photoAccessHelper.PhotoViewPicker();
      const res = await picker.select({
        MIMEType: photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE,
        maxSelectNumber: 1
      });
      if (!res || !res.photoUris || res.photoUris.length === 0) {
        event.result.handleFileList([]);
        return;
      }
      const uri: string = res.photoUris[0];
      const ctx = getContext(this);
      const ext: string = uri.indexOf('.png') > 0 ? '.png' : '.jpg';
      const dst: string = ctx.filesDir + '/picked_' + Date.now() + ext;
      await fs.copyFile(uri, dst);
      event.result.handleFileList(['file://' + dst]);
      hilog.info(DOMAIN, TAG, 'picked -> %{public}s', dst);
    } catch (err) {
      const e = err as BusinessError;
      hilog.error(DOMAIN, TAG, 'pick failed: %{public}s', JSON.stringify(e));
      event.result.handleFileList([]);
    }
  }

  onBackPress(): boolean {
    /* 网页能后退就后退，否则交给系统退出 */
    try {
      if (this.controller.accessBackward()) {
        this.controller.backward();
        return true;
      }
    } catch (e) { }
    return false;
  }

  build() {
    Stack() {
      Web({
        src: $rawfile('index.html'),
        controller: this.controller
      })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .imageAccess(true)
        .onlineImageAccess(false)
        .zoomAccess(true)
        .horizontalScrollBarAccess(false)
        .verticalScrollBarAccess(false)
        .overviewModeAccess(false)
        .darkMode(WebDarkMode.On)
        .forceDarkAccess(false)
        .mixedMode(MixedMode.Compatible)
        .onShowFileSelector((event: FileSelectorParam) => {
          this.pickIntoFileSelector(event);
          return true;
        })
        .onPageEnd(() => {
          this.ready = true;
        })
        .onErrorReceive((ev) => {
          hilog.error(DOMAIN, TAG, 'web error: %{public}s', ev.error.getErrorInfo());
        })
        .onConsole((ev) => {
          hilog.info(DOMAIN, TAG, 'console: %{public}s', ev.message.getMessage());
          return false;
        })
        .width('100%')
        .height('100%')

      if (!this.ready) {
        Column() {
          LoadingProgress()
            .width(32)
            .height(32)
            .color('#8d8d93')
          Text('Dreikanter photo')
            .fontSize(11)
            .fontColor('#6f6f76')
            .margin({ top: 10 })
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#0f0f10')
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#0f0f10')
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
  }
}
