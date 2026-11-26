import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';

const TAG: string = 'Dreikanter';
const DOMAIN: number = 0x0001;

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(DOMAIN, TAG, 'EntryAbility onCreate');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, TAG, 'loadContent failed: %{public}s', JSON.stringify(err));
        return;
      }
      /* 全屏沉浸：内容延伸到状态栏 / 导航条下方，页面自己用 env(safe-area-inset-*) 让位 */
      windowStage.getMainWindow((err2, win) => {
        if (err2.code) {
          return;
        }
        win.setWindowLayoutFullScreen(true).catch(() => { });
        win.setWindowSystemBarProperties({
          statusBarContentColor: '#FFFFFF',
          navigationBarContentColor: '#FFFFFF'
        }).catch(() => { });
      });
    });
  }

  onWindowStageDestroy(): void {
    hilog.info(DOMAIN, TAG, 'onWindowStageDestroy');
  }

  onForeground(): void {
  }

  onBackground(): void {
  }
}
