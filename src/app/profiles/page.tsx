'use client';

import { useState } from 'react';
import { useTravelConfig } from '@/lib/config/travel-config-context';
import type { TravelProfile, HotelPreference } from '@/lib/types/travel-config';

const EMPTY_PROFILE: Omit<TravelProfile, 'id'> = {
  name: '',
  seatPreference: 'any',
  mealPreference: '',
  hotelPreference: {
    starRating: 4,
    brandPreference: [],
    locationPriority: 'convenience',
  },
  preferredAirlines: [],
  budgetFlexibility: 'moderate',
  specialNeeds: '',
  isDefault: false,
};

export default function ProfilesPage() {
  const { config, addProfile, updateProfile, deleteProfile } = useTravelConfig();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Omit<TravelProfile, 'id'>>(EMPTY_PROFILE);

  const handleSave = () => {
    if (!formData.name.trim()) return;
    if (editingId) {
      updateProfile(editingId, formData);
      setEditingId(null);
    } else {
      addProfile(formData);
    }
    setFormData(EMPTY_PROFILE);
    setShowForm(false);
  };

  const handleEdit = (profile: TravelProfile) => {
    setEditingId(profile.id);
    setFormData({
      name: profile.name,
      seatPreference: profile.seatPreference,
      mealPreference: profile.mealPreference,
      hotelPreference: profile.hotelPreference,
      preferredAirlines: profile.preferredAirlines,
      budgetFlexibility: profile.budgetFlexibility,
      specialNeeds: profile.specialNeeds,
      isDefault: profile.isDefault,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData(EMPTY_PROFILE);
    setShowForm(false);
  };

  return (
    <div className="h-full bg-white dark:bg-zinc-900">
      {/* 顶栏 */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/80">
        <div className="flex items-center justify-between px-6 py-3">
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            用户偏好
          </h1>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              + 新建用户偏好
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          在对话中输入 @方案名 即可激活对应偏好（如：@出差商务 明天去上海）
        </p>

        {/* 编辑/新建表单 */}
        {showForm && (
          <div className="mb-8">
            <ProfileForm
              data={formData}
              onChange={setFormData}
              onSave={handleSave}
              onCancel={handleCancel}
              isEditing={!!editingId}
            />
          </div>
        )}

        {/* 方案列表 */}
        {config.profiles.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <svg className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p className="text-sm">暂无偏好方案</p>
            <p className="text-xs mt-1">点击右上角「+ 新建用户偏好」创建第一个方案</p>
          </div>
        )}

        <div className="space-y-4">
          {config.profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={config.activeProfileId === profile.id}
              onEdit={() => handleEdit(profile)}
              onDelete={() => deleteProfile(profile.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function ProfileCard({
  profile,
  isActive,
  onEdit,
  onDelete,
}: {
  profile: TravelProfile;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const seatMap = { window: '靠窗', aisle: '靠过道', any: '无偏好' };
  const locMap = { convenience: '便利优先', quiet: '安静优先', scenic: '风景优先' };
  const budgetMap = { strict: '严格', moderate: '适度', flexible: '灵活' };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
      {/* 卡片头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {profile.name}
          </h3>
          {profile.isDefault && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              默认
            </span>
          )}
          {isActive && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/50 dark:text-green-300">
              当前激活
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            title="编辑"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            title="删除"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* 卡片内容 — 标签网格 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Detail label="座位" value={seatMap[profile.seatPreference]} />
        <Detail label="餐饮" value={profile.mealPreference || '无要求'} />
        <Detail label="酒店" value={`${profile.hotelPreference.starRating}星 / ${locMap[profile.hotelPreference.locationPriority]}`} />
        <Detail label="预算" value={budgetMap[profile.budgetFlexibility]} />
        {profile.preferredAirlines.length > 0 && (
          <Detail label="航司" value={profile.preferredAirlines.join('、')} />
        )}
        {profile.hotelPreference.brandPreference.length > 0 && (
          <Detail label="品牌" value={profile.hotelPreference.brandPreference.join('、')} />
        )}
        {profile.specialNeeds && (
          <Detail label="特殊" value={profile.specialNeeds} className="col-span-2" />
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <span className="text-zinc-400 dark:text-zinc-500">{label}：</span>
      <span className="text-zinc-700 dark:text-zinc-300">{value}</span>
    </div>
  );
}

function ProfileForm({
  data,
  onChange,
  onSave,
  onCancel,
  isEditing,
}: {
  data: Omit<TravelProfile, 'id'>;
  onChange: (data: Omit<TravelProfile, 'id'>) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  const updateHotel = (changes: Partial<HotelPreference>) => {
    onChange({ ...data, hotelPreference: { ...data.hotelPreference, ...changes } });
  };

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {isEditing ? '编辑偏好方案' : '新建偏好方案'}
      </h3>

      {/* 方案名称 */}
      <Field label="方案名称">
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="如：出差商务、家庭度假"
          className="input-base w-full"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 座位偏好 */}
        <Field label="座位偏好">
          <div className="flex gap-4">
            {([['window', '靠窗'], ['aisle', '靠过道'], ['any', '无偏好']] as const).map(
              ([val, label]) => (
                <label key={val} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="seat"
                    value={val}
                    checked={data.seatPreference === val}
                    onChange={() => onChange({ ...data, seatPreference: val })}
                  />
                  <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
                </label>
              )
            )}
          </div>
        </Field>

        {/* 餐饮偏好 */}
        <Field label="餐饮偏好">
          <input
            type="text"
            value={data.mealPreference}
            onChange={(e) => onChange({ ...data, mealPreference: e.target.value })}
            placeholder="如：清真、素食、无要求"
            className="input-base w-full"
          />
        </Field>

        {/* 酒店星级 */}
        <Field label="酒店星级">
          <select
            value={data.hotelPreference.starRating}
            onChange={(e) => updateHotel({ starRating: Number(e.target.value) })}
            className="input-base"
          >
            <option value={3}>三星</option>
            <option value={4}>四星</option>
            <option value={5}>五星</option>
          </select>
        </Field>

        {/* 位置优先级 */}
        <Field label="位置优先">
          <div className="flex gap-4">
            {([['convenience', '便利'], ['quiet', '安静'], ['scenic', '风景']] as const).map(
              ([val, label]) => (
                <label key={val} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="location"
                    value={val}
                    checked={data.hotelPreference.locationPriority === val}
                    onChange={() => updateHotel({ locationPriority: val })}
                  />
                  <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
                </label>
              )
            )}
          </div>
        </Field>
      </div>

      {/* 酒店品牌偏好 */}
      <Field label="酒店品牌偏好">
        <input
          type="text"
          value={data.hotelPreference.brandPreference.join('、')}
          onChange={(e) =>
            updateHotel({
              brandPreference: e.target.value
                .split(/[,，、]/)
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="用顿号分隔，如：万豪、希尔顿、洲际"
          className="input-base w-full"
        />
      </Field>

      {/* 偏好航司 */}
      <Field label="偏好航司">
        <input
          type="text"
          value={data.preferredAirlines.join('、')}
          onChange={(e) =>
            onChange({
              ...data,
              preferredAirlines: e.target.value
                .split(/[,，、]/)
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="用顿号分隔，如：国航、东航、南航"
          className="input-base w-full"
        />
      </Field>

      {/* 预算弹性 */}
      <Field label="预算弹性">
        <select
          value={data.budgetFlexibility}
          onChange={(e) =>
            onChange({
              ...data,
              budgetFlexibility: e.target.value as TravelProfile['budgetFlexibility'],
            })
          }
          className="input-base"
        >
          <option value="strict">严格（不超标）</option>
          <option value="moderate">适度（可小幅超出）</option>
          <option value="flexible">灵活（优先体验）</option>
        </select>
      </Field>

      {/* 特殊需求 */}
      <Field label="特殊需求">
        <textarea
          value={data.specialNeeds}
          onChange={(e) => onChange({ ...data, specialNeeds: e.target.value })}
          placeholder="如：需要无障碍房间、对花粉过敏"
          rows={2}
          className="input-base w-full resize-none"
        />
      </Field>

      {/* 设为默认 */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.isDefault}
          onChange={(e) => onChange({ ...data, isDefault: e.target.checked })}
        />
        <span className="text-zinc-700 dark:text-zinc-300">
          设为默认方案（未使用 @提及时自动生效）
        </span>
      </label>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={!data.name.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isEditing ? '保存修改' : '创建方案'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}
