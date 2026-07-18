#!/bin/bash
# SSH诊断脚本 - 在服务器上执行

echo "=== SSH配置检查 ==="
sudo grep -E "MaxStartups|MaxSessions|LoginGraceTime" /etc/ssh/sshd_config

echo -e "\n=== 当前SSH连接数 ==="
ps aux | grep sshd | grep -v grep

echo -e "\n=== fail2ban状态 ==="
if command -v fail2ban-client &> /dev/null; then
    sudo fail2ban-client status sshd 2>/dev/null || echo "fail2ban未安装或sshd监狱未启用"
else
    echo "fail2ban未安装"
fi

echo -e "\n=== 最近的SSH连接日志 ==="
sudo journalctl -u ssh -n 20 --no-pager

echo -e "\n=== 系统资源使用 ==="
free -h
df -h /
