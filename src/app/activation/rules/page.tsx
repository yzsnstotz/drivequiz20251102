"use client";

import React from "react";
import { ChevronLeft, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "@/components/common/Header";

export default function ActivationRulesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="激活码使用规则" />
      
      <div className="container mx-auto px-4 py-6 pb-20">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <FileText className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">激活码使用规则</h1>
          </div>

          <div className="prose prose-sm max-w-none">
            <section className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">1. 激活码有效期</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>激活码自首次激活之日起开始计算有效期</li>
                <li>有效期根据激活码类型而定，可能为按天、按月或按年计算</li>
                <li>有效期到期后，激活码将自动失效，需要重新激活</li>
                <li>您可以在&ldquo;我的&rdquo;页面查看当前激活码的到期时间</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 使用限制</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>每个激活码可能有使用次数限制，达到上限后将无法继续使用</li>
                <li>激活码仅限本人使用，不得转让或分享给他人</li>
                <li>激活码与您的账户邮箱绑定，更换邮箱需要重新激活</li>
                <li>一个激活码只能在一个账户上激活使用</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">3. 激活码状态</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li><strong>已激活</strong>：激活码正常使用中，可以享受AI功能服务</li>
                <li><strong>未激活</strong>：尚未激活或激活失败，需要输入有效的激活码</li>
                <li><strong>已过期</strong>：激活码有效期已到期，需要重新激活</li>
                <li><strong>已暂停</strong>：激活码因违规使用等原因被暂停，请联系客服</li>
                <li><strong>已禁用</strong>：激活码已被禁用，无法继续使用</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">4. 激活码适用范围</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>激活码仅用于解锁AI助手功能</li>
                <li>激活后，您可以使用以下AI功能：
                  <ul className="list-circle list-inside ml-4 mt-2 space-y-1">
                    <li>首页AI聊天助手</li>
                    <li>学习页面题目AI解析</li>
                    <li>AI智能问答功能</li>
                  </ul>
                </li>
                <li>其他基础功能（如题目练习、错题本等）无需激活即可使用</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">5. 注意事项</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>请妥善保管您的激活码，避免泄露给他人</li>
                <li>激活码一旦使用，将无法退款或撤销</li>
                <li>如遇到激活问题，请联系客服获取帮助</li>
                <li>系统会定期检查激活状态，确保激活码的有效性</li>
                <li>激活状态会在您使用AI功能时自动验证</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">6. 激活流程</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>在需要使用AI功能时，系统会提示您输入激活码</li>
                <li>输入您的邮箱和激活码</li>
                <li>系统验证激活码的有效性</li>
                <li>验证成功后，激活码将与您的账户绑定</li>
                <li>激活成功后，您可以正常使用AI功能</li>
              </ol>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">7. 常见问题</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Q: 激活码过期后怎么办？</h3>
                  <p className="text-gray-700 text-sm">
                    A: 激活码过期后，您需要获取新的激活码并重新激活。过期后无法继续使用AI功能。
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Q: 可以同时使用多个激活码吗？</h3>
                  <p className="text-gray-700 text-sm">
                    A: 不可以。一个账户只能激活一个激活码。新的激活码会替换旧的激活码。
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Q: 激活码丢失了怎么办？</h3>
                  <p className="text-gray-700 text-sm">
                    A: 请联系客服，提供您的账户信息，客服会协助您处理。
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t">
            <button
              onClick={() => router.back()}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

