export type SelectOption = {
  label: string;
  value: string;
};

// default hometown
export const DEFAULT_HOMETOWN = '保密';

// hometown select options (can be extended as needed)
export const HOMETOWN_OPTIONS: SelectOption[] = [
    { label: '保密', value: 'Default' },
    { label: '北京', value: 'BeiJing' },
    { label: '天津', value: 'TianJin' },
    { label: '河北', value: 'HeBei' },
    { label: '山西', value: 'ShenXi' },
    { label: '内蒙古', value: 'NeiMengGu' },
    { label: '辽宁', value: 'LiaoNing' },
    { label: '吉林', value: 'JiLin' },
    { label: '黑龙江', value: 'HeiLongJiang' },
    { label: '上海', value: 'ShangHai' },
    { label: '江苏', value: 'JiangSu' },
    { label: '浙江', value: 'ZheJiang' },
    { label: '安徽', value: 'AnHui' },
    { label: '福建', value: 'FuJian' },
    { label: '江西', value: 'JiangXi' },
    { label: '山东', value: 'HeFei' },
    { label: '河南', value: 'HeNan' },
    { label: '湖北', value: 'HuBei' },
    { label: '湖南', value: 'HuNan' },
    { label: '广东', value: 'GuangDong' },
    { label: '广西', value: 'GuangXi' },
    { label: '海南', value: 'HaiNan' },
    { label: '重庆', value: 'ChongQing' },
    { label: '四川', value: 'SiChuan' },
    { label: '贵州', value: 'GuiZhou' },
    { label: '云南', value: 'YunNan' },
    { label: '西藏', value: 'XiZang' },
    { label: '陕西', value: 'ShanXi' },
    { label: '甘肃', value: 'GanSu' },
    { label: '青海', value: 'QingHai' },
    { label: '宁夏', value: 'NingXia' },
    { label: '新疆', value: 'XinJiang' },
    { label: '台湾', value: 'TaiWan' },
    { label: '香港', value: 'XiangGang' },
    { label: '澳门', value: 'AoMen' },
    { label: '海外', value: 'Overseas' },
];

// 食堂位置选项
export const CANTEEN_OPTIONS: SelectOption[] = [
    { label: '不选择', value: '' },
    { label: '旦苑食堂', value: '旦苑食堂' },
    { label: '北区食堂', value: '北区食堂' },
    { label: '南区食堂', value: '南区食堂' },
    { label: '南苑食堂', value: '南苑食堂' },
    { label: '教工餐厅', value: '教工餐厅' },
    { label: '南区民族餐厅', value: '南区民族餐厅' },
    { label: '江湾食堂', value: '江湾食堂' },
    { label: '江湾光华餐厅', value: '江湾光华餐厅' },
    { label: '江湾北食堂', value: '江湾北食堂' },
    { label: '江湾民族餐厅', value: '江湾民族餐厅' },
    { label: '江湾餐车', value: '江湾餐车' },
    { label: '枫林食堂', value: '枫林食堂' },
    { label: '枫林民族餐厅', value: '枫林民族餐厅' },
    { label: '护理学院餐厅', value: '护理学院餐厅' },
    { label: '张江食堂', value: '张江食堂' },
];

export function findOptionLabel(options: SelectOption[], value?: string | null): string | undefined {
  if (!value) return undefined;
  const found = options.find((o) => o.value === value);
  return found?.label;
}
