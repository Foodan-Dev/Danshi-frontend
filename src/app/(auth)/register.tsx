import React from 'react';
import Head from 'expo-router/head';
import RegisterScreen from '@/src/screens/register_screen';

export default function Register() {
  return (
    <>
      <Head>
        <title>旦食 · 注册</title>
        <meta name="description" content="注册旦食账号，验证邮箱后加入校园美食社区。" />
      </Head>
      <RegisterScreen />
    </>
  );
}
